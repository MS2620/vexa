import { openDb } from "@/lib/db";
import { createSymlinks } from "@/lib/symlinks";
import { addLog } from "@/lib/logger";
import { notifyUsers } from "@/lib/notifications";
import { access } from "fs/promises";
import { createDebridClient, DebridFile } from "@/lib/debrid/client";

type Stream = {
  infoHash?: string;
  name?: string;
  title?: string;
};

type EpisodeCandidate = {
  tmdbId: string;
  showName: string;
  posterPath: string | null;
  season: number;
  episode: number;
  episodeName: string;
  airDate: string;
};

const RESOLUTION_SCORE: Record<string, number> = {
  "2160p": 4,
  "4k": 4,
  uhd: 4,
  "1080p": 3,
  "720p": 2,
  "480p": 1,
};

const globalState = globalThis as typeof globalThis & {
  __episodeAutomationStarted?: boolean;
  __episodeAutomationTimer?: ReturnType<typeof setInterval>;
  __episodeAutomationRunning?: boolean;
  __episodeAutomationLastEveningDate?: string;
  __episodeAutomationLastMorningDate?: string;
};

function episodeLabel(ep: {
  showName: string;
  season: number;
  episode: number;
}): string {
  return `${ep.showName} S${String(ep.season).padStart(2, "0")}E${String(ep.episode).padStart(2, "0")}`;
}

async function logAutomation(
  level: "info" | "warn" | "error" | "success",
  message: string,
  context?: unknown,
): Promise<void> {
  const logMessage = `[automation] ${message}`;

  if (level === "error") {
    console.error(logMessage, context ?? "");
  } else {
    console.log(logMessage);
  }

  await addLog(level, logMessage, context);
}

function dateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function getWatchlistCandidatesForDate(
  targetDate: string,
): Promise<EpisodeCandidate[]> {
  const db = await openDb();
  const settings = await db.get(
    "SELECT plex_url, plex_token, plex_tv_lib_id, jellyfin_url, jellyfin_token, tmdb_key FROM settings WHERE id = 1",
  );

  // Need at least one service configured
  if (
    !settings?.tmdb_key ||
    (!settings?.plex_url && !settings?.jellyfin_url)
  ) {
    return [];
  }

  // Use Plex or Jellyfin to get watchlist
  const libraryUrl = settings.plex_url
    ? `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/all?X-Plex-Token=${settings.plex_token}&includeGuids=1`
    : `${settings.jellyfin_url}/Users/Me/Items?parentId=${settings.jellyfin_tv_lib_id}&X-Emby-Token=${settings.jellyfin_token}`;

  const res = await fetch(libraryUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];

  const data = await res.json();
  
  // Parse Plex or Jellyfin response
  let allShows: any[] = [];
  if (settings.plex_url) {
    allShows = data.MediaContainer?.Metadata || [];
  } else {
    allShows = data.Items || [];
  }

  const extractedTmdbIds = allShows
    .map((show: { Guid?: { id?: string }[] }) => {
      const tmdbGuid = (show.Guid || []).find((g) =>
        g.id?.startsWith("tmdb://"),
      );
      return tmdbGuid?.id ? tmdbGuid.id.replace("tmdb://", "") : null;
    })
    .filter((id: string | null): id is string => Boolean(id));

  const tmdbIds = [...new Set<string>(extractedTmdbIds)];

  const details = await Promise.all(
    tmdbIds.map(async (tmdbId) => {
      try {
        const tvRes = await fetch(
          `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${settings.tmdb_key}`,
        );
        if (!tvRes.ok) return null;
        const tvData = await tvRes.json();
        const next = tvData.next_episode_to_air;
        if (!next?.air_date) return null;
        if (next.air_date !== targetDate) return null;

        return {
          tmdbId,
          showName: tvData.name || "Unknown",
          posterPath: tvData.poster_path || null,
          season: next.season_number || 1,
          episode: next.episode_number || 1,
          episodeName: next.name || "Untitled Episode",
          airDate: next.air_date,
        } satisfies EpisodeCandidate;
      } catch {
        return null;
      }
    }),
  );

  return details.filter((d): d is EpisodeCandidate => d !== null);
}

function scoreStreams(
  streams: Stream[],
  preferredResolution: string,
  preferredLanguage: string,
): Stream[] {
  return streams
    .map((stream) => {
      const nameLower = (stream.name || "").toLowerCase();
      const titleLower = (stream.title || "").toLowerCase();
      const combined = `${nameLower} ${titleLower}`;

      let resScore = 0;
      for (const [key, score] of Object.entries(RESOLUTION_SCORE)) {
        if (combined.includes(key)) {
          resScore = score;
          break;
        }
      }

      const preferredResScore = RESOLUTION_SCORE[preferredResolution] || 3;
      const resMatch =
        resScore === preferredResScore
          ? 100
          : Math.max(0, 50 - Math.abs(resScore - preferredResScore) * 20);

      const langMatch =
        combined.includes(preferredLanguage) ||
        (preferredLanguage === "en" &&
          !combined.match(
            /\b(french|german|spanish|italian|portuguese|japanese|korean|chinese|hindi|arabic|dubbed)\b/,
          ))
          ? 50
          : 0;

      const cachedBonus =
        combined.includes("[rd+]") || combined.includes("[rd]") ? 200 : 0;

      return { stream, total: resMatch + langMatch + cachedBonus };
    })
    .sort((a, b) => b.total - a.total)
    .map((s) => s.stream);
}

async function findBestInfoHashes(
  tmdbId: string,
  season: number,
  episode: number,
): Promise<string[]> {
  const db = await openDb();
  const settings = await db.get(
    "SELECT tmdb_key, preferred_resolution, preferred_language FROM settings WHERE id = 1",
  );
  if (!settings?.tmdb_key) return [];

  const tmdbRes = await fetch(
    `https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${settings.tmdb_key}`,
  );
  if (!tmdbRes.ok) return [];
  const tmdbData = await tmdbRes.json();
  const imdbId = tmdbData.imdb_id;
  if (!imdbId) return [];

  const torrentioRes = await fetch(
    `https://torrentio.strem.fun/stream/series/${imdbId}:${season}:${episode}.json`,
  );
  if (!torrentioRes.ok) return [];
  const torrentioData = await torrentioRes.json();
  const rawStreams: Stream[] = torrentioData.streams || [];

  const blocklisted = await db.all<{ info_hash: string }[]>(
    "SELECT info_hash FROM blocklist",
  );
  const blockedSet = new Set(blocklisted.map((b) => b.info_hash.toLowerCase()));

  const eligible = rawStreams.filter(
    (s) => s.infoHash && !blockedSet.has(s.infoHash.toLowerCase()),
  );

  const scored = scoreStreams(
    eligible,
    (settings?.preferred_resolution || "1080p").toLowerCase(),
    (settings?.preferred_language || "en").toLowerCase(),
  );

  return scored
    .map((s) => s.infoHash!)
    .filter(Boolean)
    .slice(0, 5);
}

async function downloadInfoHash(
  infoHash: string,
  tmdbId: string,
  title: string,
  posterPath: string | null,
  season: number,
  episode: number,
): Promise<boolean> {
  const db = await openDb();
  const settings = await db.get(
    `SELECT
       debrid_provider,
       rd_token,
       torbox_api_key,
       plex_url,
       plex_token,
       plex_tv_lib_id,
       jellyfin_url,
       jellyfin_token,
       jellyfin_tv_lib_id,
       tmdb_key
     FROM settings WHERE id = 1`,
  );

  // Build debrid client (Real-Debrid or TorBox)
  let client;
  try {
    client = createDebridClient({
      provider: settings?.debrid_provider || "realdebrid",
      rd_token: settings?.rd_token || undefined,
      torbox_api_key: settings?.torbox_api_key || undefined,
    });
  } catch {
    return false;
  }

  // Avoid duplicate requests for the same episode
  const exists = await db.get(
    `SELECT id FROM requests
     WHERE media_type = 'tv' AND tmdb_id = ? AND season = ? AND episode = ?
       AND status IN ('Requested', 'Available', 'Pending Approval')
     LIMIT 1`,
    [tmdbId, season, episode],
  );
  if (exists) return true;

  const magnet = `magnet:?xt=urn:btih:${infoHash}`;

  // 1. Add magnet to provider
  let torrentId: string | number;
  try {
    const added = await client.addMagnet(magnet, title);
    torrentId = added.id;
  } catch (e) {
    console.error("[automation] addMagnet failed:", e);
    return false;
  }

  // 2. Wait briefly and fetch info
  await new Promise((resolve) => setTimeout(resolve, 2000));

  let info;
  try {
    info = await client.getTorrentInfo(torrentId);
  } catch (e) {
    console.error("[automation] getTorrentInfo failed:", e);
    return false;
  }

  if (!info.files || info.files.length === 0) return false;

  const files = info.files as DebridFile[];

  const videoFiles = files.filter((f) => {
    const isVideo = f.path.match(/\.(mkv|mp4|avi)$/i);
    const isNotSample = !f.path.toLowerCase().includes("sample");
    const isLargeEnough = f.bytes > 30 * 1024 * 1024;
    return isVideo && isNotSample && isLargeEnough;
  });

  const fileIds =
    videoFiles.length > 0
      ? videoFiles.map((f) => f.id)
      : [files.sort((a, b) => b.bytes - a.bytes)[0].id];

  try {
    await client.selectFiles(torrentId, fileIds);
  } catch (e) {
    console.error("[automation] selectFiles failed:", e);
    // For TorBox this is effectively a no-op; continue anyway
  }

  // Optional re-poll (mainly useful for RD)
  try {
    info = await client.getTorrentInfo(torrentId);
  } catch {
    // ignore, keep previous info
  }

  // Create symlinks/hardlinks via existing helper
  const { plex: plexPaths, jellyfin: jellyfinPaths } = await createSymlinks({
    infoData: { filename: info.filename || title, files: info.files },
    title,
    tmdbId,
    mediaType: "tv",
    season,
    episode,
    tmdbKey: settings.tmdb_key || "",
    provider: settings.debrid_provider || "realdebrid",
  });

  // Wait for files to appear
  const checkPath = plexPaths[0] || jellyfinPaths[0];
  if (checkPath) {
    let fileExists = false;
    let attempts = 0;
    const maxAttempts = 24;

    while (!fileExists && attempts < maxAttempts) {
      try {
        await access(checkPath);
        fileExists = true;
      } catch {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  // Insert request record
  await db.run(
    `INSERT INTO requests
      (tmdb_id, title, poster_path, status, requested_by, media_type, season, episode, info_hash, approved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tmdbId,
      title,
      posterPath,
      "Requested",
      "auto-scheduler",
      "tv",
      season,
      episode,
      infoHash,
      1,
    ],
  );

  // Trigger library scans
  const scansTriggered: string[] = [];

  if (settings.plex_url && settings.plex_token && settings.plex_tv_lib_id) {
    try {
      const refreshRes = await fetch(
        `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/refresh?X-Plex-Token=${settings.plex_token}`,
      );
      if (refreshRes.ok) {
        scansTriggered.push("Plex");
        console.log(`[automation] Plex scan triggered for ${title}`);
      }
    } catch (e) {
      console.error("Plex refresh failed:", e);
    }
  }

  if (
    settings.jellyfin_url &&
    settings.jellyfin_token &&
    settings.jellyfin_tv_lib_id
  ) {
    try {
      const scanRes = await fetch(
        `${settings.jellyfin_url}/Library/Refresh?X-Emby-Token=${settings.jellyfin_token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            LibraryOptions: {
              Name: settings.jellyfin_tv_lib_id,
            },
          }),
        },
      );

      if (scanRes.ok) {
        scansTriggered.push("Jellyfin");
        console.log(`[automation] Jellyfin scan triggered for ${title}`);
      }
    } catch (e) {
      console.error("Jellyfin refresh failed:", e);
    }
  }

  if (scansTriggered.length > 0) {
    setTimeout(async () => {
      await notifyUsers({
        type: "automation",
        title: `${title} added to library`,
        body: `S${String(season).padStart(2, "0")}E${String(
          episode,
        ).padStart(2, "0")} was added and ${scansTriggered.join(
          " & ",
        )} refresh triggered.`,
        targetPath: `/media/tv/${tmdbId}`,
      });
    }, 5000);
  }

  return true;
}

async function upsertPendingRetry(ep: EpisodeCandidate): Promise<void> {
  const db = await openDb();
  await db.run(
    `INSERT INTO auto_episode_retry
      (tmdb_id, show_name, poster_path, season, episode, episode_name, air_date, status, attempts, last_checked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 1, CURRENT_TIMESTAMP)
     ON CONFLICT(tmdb_id, season, episode)
     DO UPDATE SET
       show_name = excluded.show_name,
       poster_path = excluded.poster_path,
       episode_name = excluded.episode_name,
       air_date = excluded.air_date,
       status = 'pending',
       attempts = auto_episode_retry.attempts + 1,
       last_checked_at = CURRENT_TIMESTAMP`,
    [
      ep.tmdbId,
      ep.showName,
      ep.posterPath,
      ep.season,
      ep.episode,
      ep.episodeName,
      ep.airDate,
    ],
  );
}

async function markPendingAsDownloaded(
  tmdbId: string,
  season: number,
  episode: number,
): Promise<void> {
  const db = await openDb();
  await db.run(
    `UPDATE auto_episode_retry
     SET status = 'downloaded', last_checked_at = CURRENT_TIMESTAMP
     WHERE tmdb_id = ? AND season = ? AND episode = ?`,
    [tmdbId, season, episode],
  );
}

async function attemptEpisodeDownload(ep: EpisodeCandidate): Promise<boolean> {
  const candidateHashes = await findBestInfoHashes(
    ep.tmdbId,
    ep.season,
    ep.episode,
  );
  if (candidateHashes.length === 0) {
    await logAutomation("info", `No streams found for ${episodeLabel(ep)}`, {
      tmdbId: ep.tmdbId,
    });
    return false;
  }

  for (const hash of candidateHashes) {
    const ok = await downloadInfoHash(
      hash,
      ep.tmdbId,
      ep.showName,
      ep.posterPath,
      ep.season,
      ep.episode,
    );
    if (ok) {
      await logAutomation(
        "success",
        `Added ${episodeLabel(ep)} from hash ${hash.slice(0, 8)}...`,
        {
          tmdbId: ep.tmdbId,
          season: ep.season,
          episode: ep.episode,
          hashPrefix: hash.slice(0, 8),
        },
      );
      return true;
    }
  }

  await logAutomation(
    "warn",
    `Tried ${candidateHashes.length} stream(s) but none succeeded for ${episodeLabel(ep)}`,
    {
      tmdbId: ep.tmdbId,
      triedStreams: candidateHashes.length,
    },
  );
  return false;
}

async function runEveningScan(todayKey: string): Promise<void> {
  await logAutomation("info", `Evening scan started for ${todayKey}`);
  const todaysEpisodes = await getWatchlistCandidatesForDate(todayKey);
  if (todaysEpisodes.length === 0) {
    await logAutomation(
      "info",
      "Evening scan: no watchlist episodes airing today",
    );
    return;
  }

  let downloaded = 0;
  let queued = 0;

  await logAutomation(
    "info",
    `Evening scan: ${todaysEpisodes.length} candidate episode(s)`,
  );

  for (const ep of todaysEpisodes) {
    const success = await attemptEpisodeDownload(ep);
    if (success) {
      await markPendingAsDownloaded(ep.tmdbId, ep.season, ep.episode);
      downloaded++;
    } else {
      await upsertPendingRetry(ep);
      queued++;
    }
  }

  await logAutomation(
    "info",
    `Evening scan complete: downloaded=${downloaded}, queued_for_retry=${queued}`,
    {
      date: todayKey,
      downloaded,
      queued,
    },
  );
}

async function runMorningRetry(today: Date): Promise<void> {
  const db = await openDb();
  const yesterdayKey = dateKey(addDays(today, -1));

  await logAutomation(
    "info",
    `Morning retry started for pending episodes up to ${yesterdayKey}`,
  );

  const pending = await db.all<
    {
      tmdb_id: string;
      show_name: string;
      poster_path: string | null;
      season: number;
      episode: number;
      episode_name: string;
      air_date: string;
    }[]
  >(
    `SELECT tmdb_id, show_name, poster_path, season, episode, episode_name, air_date
     FROM auto_episode_retry
     WHERE status = 'pending' AND air_date <= ?`,
    [yesterdayKey],
  );

  if (pending.length === 0) {
    await logAutomation("info", "Morning retry: no pending episodes to check");
    return;
  }

  let downloaded = 0;
  let stillPending = 0;

  await logAutomation(
    "info",
    `Morning retry: ${pending.length} pending episode(s)`,
  );

  for (const ep of pending) {
    const success = await attemptEpisodeDownload({
      tmdbId: ep.tmdb_id,
      showName: ep.show_name,
      posterPath: ep.poster_path,
      season: ep.season,
      episode: ep.episode,
      episodeName: ep.episode_name,
      airDate: ep.air_date,
    });

    if (success) {
      await markPendingAsDownloaded(ep.tmdb_id, ep.season, ep.episode);
      downloaded++;
    } else {
      await upsertPendingRetry({
        tmdbId: ep.tmdb_id,
        showName: ep.show_name,
        posterPath: ep.poster_path,
        season: ep.season,
        episode: ep.episode,
        episodeName: ep.episode_name,
        airDate: ep.air_date,
      });
      stillPending++;
    }
  }

  await logAutomation(
    "info",
    `Morning retry complete: downloaded=${downloaded}, still_pending=${stillPending}`,
    {
      upToDate: yesterdayKey,
      downloaded,
      stillPending,
    },
  );
}

async function tick(): Promise<void> {
  if (globalState.__episodeAutomationRunning) return;
  globalState.__episodeAutomationRunning = true;

  try {
    const now = new Date();
    const todayKey = dateKey(now);
    const hour = now.getHours();

    await logAutomation("info", `Scheduler tick started (hour=${hour})`, {
      date: todayKey,
      hour,
    });

    // Evening run window (18:00-22:59), once per day
    if (
      hour >= 18 &&
      hour <= 22 &&
      globalState.__episodeAutomationLastEveningDate !== todayKey
    ) {
      await logAutomation("info", "Triggering evening window run", {
        date: todayKey,
      });
      await runEveningScan(todayKey);
      globalState.__episodeAutomationLastEveningDate = todayKey;
    }

    // Morning retry window (06:00-10:59), once per day
    if (
      hour >= 6 &&
      hour <= 10 &&
      globalState.__episodeAutomationLastMorningDate !== todayKey
    ) {
      await logAutomation("info", "Triggering morning retry window run", {
        date: todayKey,
      });
      await runMorningRetry(now);
      globalState.__episodeAutomationLastMorningDate = todayKey;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await logAutomation("error", "Episode scheduler error", { message: msg });
  } finally {
    globalState.__episodeAutomationRunning = false;
  }
}

export function ensureEpisodeAutomationStarted(): void {
  if (globalState.__episodeAutomationStarted) return;
  globalState.__episodeAutomationStarted = true;

  // Run an initial tick shortly after startup, then every 15 minutes.
  setTimeout(() => {
    void tick();
  }, 5000);

  globalState.__episodeAutomationTimer = setInterval(
    () => {
      void tick();
    },
    15 * 60 * 1000,
  );

  void logAutomation("success", "Episode scheduler started", {
    intervalMinutes: 15,
  });
}