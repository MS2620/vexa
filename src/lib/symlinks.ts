import path from "path";
import fs from "fs/promises";
import type { DebridFile } from "./debrid/client";

const RD_MOUNT = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
const TORBOX_MOUNT = process.env.TORBOX_MOUNT || "/mnt/torbox";
const PLEX_SYMLINK_ROOT =
  process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";
const JELLYFIN_LINK_ROOT =
  process.env.JELLYFIN_LINK_ROOT || "/mnt/jellyfin_links";

interface SymlinkParams {
  infoData: { filename: string; files: DebridFile[] };
  title: string;
  tmdbId: string | null;
  mediaType: "movie" | "tv";
  season: number | null;
  episode?: number | null;
  tmdbKey: string;
  provider?: "realdebrid" | "torbox";
}

function classifyResolution(p: string): string {
  const s = p.toLowerCase();
  if (s.includes("2160p") || s.includes("4k") || s.includes("uhd")) return "4K";
  if (s.includes("1080p")) return "1080p";
  if (s.includes("720p")) return "720p";
  return "SD";
}

function buildVersionLabel(filePath: string): string {
  return classifyResolution(filePath);
}

// Try to pull SxxExx (or just Exx) out of the actual filename first.
// Falls back to the request-level season/episode if parsing fails.
function resolveEpisodeTag(
  filePath: string,
  fallbackSeason: number | null,
  fallbackEpisode: number | null | undefined,
): { season: number; episode: number } {
  const name = path.basename(filePath);

  // Match S01E06, s1e6, 1x06, etc.
  const seMatch = name.match(/[Ss](\d{1,2})[Ee](\d{1,3})/);
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
    };
  }

  const xMatch = name.match(/(\d{1,2})[xX](\d{1,3})/);
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
    };
  }

  // Match standalone Exx when season is already known from context
  const eOnlyMatch = name.match(/[Ee](\d{2,3})(?!\d)/);
  if (eOnlyMatch && fallbackSeason) {
    return {
      season: fallbackSeason,
      episode: parseInt(eOnlyMatch[1], 10),
    };
  }

  return {
    season: fallbackSeason ?? 1,
    episode: fallbackEpisode ?? 1,
  };
}

function episodeTag(season: number, episode: number): string {
  return `S${String(season).padStart(2, "0")}E${String(episode).padStart(
    2,
    "0",
  )}`;
}

export async function createSymlinks({
  infoData,
  title,
  tmdbId,
  mediaType,
  season,
  episode,
  tmdbKey,
  provider = "realdebrid",
}: SymlinkParams): Promise<{ plex: string[]; jellyfin: string[] }> {
  const plexPaths: string[] = [];
  const jellyfinPaths: string[] = [];

  const DEBRID_MOUNT = provider === "torbox" ? TORBOX_MOUNT : RD_MOUNT;

  try {
    await fs.access(DEBRID_MOUNT);
  } catch {
    console.warn(
      `[symlinks] ${DEBRID_MOUNT} not accessible — skipping symlink creation`,
    );
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  let year = "";
  if (tmdbId && tmdbKey) {
    try {
      const endpoint =
        mediaType === "movie"
          ? `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`
          : `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      const dateStr =
        mediaType === "movie" ? data.release_date : data.first_air_date;
      if (dateStr) year = (dateStr as string).slice(0, 4);
    } catch {
      // ignore, continue without year
    }
  }

  const baseName = year ? `${title} (${year})` : title;

  const videoFiles = infoData.files.filter((f) =>
    /\.(mkv|mp4|avi)$/i.test(f.path),
  );

  if (videoFiles.length === 0) {
    console.warn(`[symlinks] No video files found for "${title}"`);
    return { plex: plexPaths, jellyfin: jellyfinPaths };
  }

  for (const file of videoFiles) {
    const parts = file.path.replace(/^\//, "").split("/");
    const sourcePath =
      parts.length === 1
        ? path.join(DEBRID_MOUNT, infoData.filename, parts[0])
        : path.join(DEBRID_MOUNT, file.path);

    const ext = path.extname(file.path) || ".mkv";
    const versionLabel = buildVersionLabel(file.path);

    // Resolve per-file episode info (handles season packs correctly)
    const resolved =
      mediaType === "tv"
        ? resolveEpisodeTag(file.path, season, episode)
        : { season: season ?? 1, episode: episode ?? 1 };

    const epTag = episodeTag(resolved.season, resolved.episode);

    // ---------- Plex ----------
    {
      const plexTargetDir = path.join(
        PLEX_SYMLINK_ROOT,
        mediaType === "movie" ? "Movies" : "TV_Shows",
        baseName,
        ...(mediaType === "tv"
          ? [`Season ${String(resolved.season).padStart(2, "0")}`]
          : []),
      );
      await fs.mkdir(plexTargetDir, { recursive: true });

      const plexFileName =
        mediaType === "tv"
          ? `${baseName} - ${epTag}${ext}`
          : path.basename(file.path);

      const plexTargetPath = path.join(plexTargetDir, plexFileName);

      try {
        await fs.symlink(sourcePath, plexTargetPath);
        console.log(`[plex] ${plexTargetPath} → ${sourcePath}`);
        plexPaths.push(plexTargetPath);
      } catch (e: any) {
        if (e.code === "EEXIST") {
          plexPaths.push(plexTargetPath);
        } else {
          console.error(`[plex] symlink failed: ${e.message}`);
        }
      }
    }

    // ---------- Jellyfin ----------
    if (JELLYFIN_LINK_ROOT) {
      const jfTargetDir = path.join(
        JELLYFIN_LINK_ROOT,
        mediaType === "movie" ? "Movies" : "TV_Shows",
        baseName,
        ...(mediaType === "tv"
          ? [`Season ${String(resolved.season).padStart(2, "0")}`]
          : []),
      );
      await fs.mkdir(jfTargetDir, { recursive: true });

      let jfFileName: string;
      if (mediaType === "tv") {
        jfFileName =
          versionLabel && versionLabel !== "SD"
            ? `${baseName} - ${epTag} - ${versionLabel}${ext}`
            : `${baseName} - ${epTag}${ext}`;
      } else {
        jfFileName =
          versionLabel && versionLabel !== "SD"
            ? `${baseName} - ${versionLabel}${ext}`
            : `${baseName}${ext}`;
      }

      const jfTargetPath = path.join(jfTargetDir, jfFileName);

      try {
        await fs.symlink(sourcePath, jfTargetPath);
        console.log(`[jellyfin] ${jfTargetPath} → ${sourcePath}`);
        jellyfinPaths.push(jfTargetPath);
      } catch (e: any) {
        if (e.code === "EEXIST") {
          jellyfinPaths.push(jfTargetPath);
        } else {
          console.error(`[jellyfin] symlink failed: ${e.message}`);
        }
      }
    }
  }

  return { plex: plexPaths, jellyfin: jellyfinPaths };
}