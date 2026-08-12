import { getSession } from "@/lib/session";
import { openDb } from "@/lib/db";
import { createSymlinks } from "@/lib/symlinks";

type RDFile = { id: number; path: string; bytes: number; selected: number };
type ParsedName = {
  title: string;
  year: string | null;
  mediaType: "movie" | "tv";
  season: number | null;
};

type TmdbMatch = { id: number; title: string; mediaType: "movie" | "tv" };

function parseTorrentName(filename: string): ParsedName {
  let s = filename.replace(/\.(mkv|mp4|avi|mov|wmv|m4v|ts|iso)$/i, "");
  s = s.replace(/^\[[\w\s.:-]+\]\s*/, "");
  s = s.replace(/^(?:https?:\/\/)?www\.[\w.-]+\.[a-z]{2,6}\s*[-–—|]\s*/i, "");
  s = s.replace(/^【[^】]*】\s*/, "");
  s = s.replace(/[._]/g, " ").trim();
  s = s.replace(/\[(?!\d{4}\])[^\]]*\]/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  const multiSeason = s.match(/^(.+?)\s+[Ss](\d{1,2})-[Ss]\d{1,2}/i);
  if (multiSeason)
    return buildTvParsedName(multiSeason[1], parseInt(multiSeason[2], 10));

  const sxex = s.match(/^(.+?)\s+[Ss](\d{1,2})[Ee]\d{1,2}/i);
  if (sxex)
    return buildTvParsedName(sxex[1], parseInt(sxex[2], 10));

  const parenSeason = s.match(
    /^(.+?)\s+\((?:[Ss]eason\s+(\d{1,2})|[Ss](\d{2}))\)/i,
  );
  if (parenSeason) {
    const season = parseInt(parenSeason[2] ?? parenSeason[3], 10);
    if (!isNaN(season)) return buildTvParsedName(parenSeason[1], season);
  }

  const pack = s.match(
    /^(.+?)\s+(?:[Ss]eason\s+(\d{1,2})|[Ss](\d{2})(?:\s|$))/i,
  );
  if (pack) {
    const season = parseInt(pack[2] ?? pack[3], 10);
    if (!isNaN(season)) return buildTvParsedName(pack[1], season);
  }

  const seasonWithSPrefix = s.match(
    /^(.+?)\s+[Ss]eason\s+[Ss](\d{1,2})(?:\s|$)/i,
  );
  if (seasonWithSPrefix) {
    const season = parseInt(seasonWithSPrefix[2], 10);
    if (!isNaN(season)) return buildTvParsedName(seasonWithSPrefix[1], season);
  }

  const withYearSquare = s.match(/^(.+?)\s+\[((?:19|20)\d{2})\]/);
  if (withYearSquare)
    return {
      title: cleanTitle(withYearSquare[1]),
      year: withYearSquare[2],
      mediaType: "movie",
      season: null,
    };

  const withYearParen = s.match(/^(.+?)\s+\(((?:19|20)\d{2})[^)]*\)/);
  if (withYearParen)
    return {
      title: cleanTitle(withYearParen[1]),
      year: withYearParen[2],
      mediaType: "movie",
      season: null,
    };

  const withYear = s.match(/^(.+?)\s+((?:19|20)\d{2})(?:\s|$)/);
  if (withYear)
    return {
      title: cleanTitle(withYear[1]),
      year: withYear[2],
      mediaType: "movie",
      season: null,
    };

  return { title: cleanTitle(s), year: null, mediaType: "movie", season: null };
}

function buildTvParsedName(rawTitle: string, season: number): ParsedName {
  const normalized = cleanTitle(rawTitle);
  const parenYear = normalized.match(/\(((?:19|20)\d{2})\)\s*$/);
  const bareYear = normalized.match(/\s+((?:19|20)\d{2})\s*$/);
  const year = parenYear?.[1] ?? bareYear?.[1] ?? null;

  return {
    title: cleanTvTitle(normalized),
    year,
    mediaType: "tv",
    season,
  };
}

function cleanTitle(s: string): string {
  return s
    .replace(
      /\b(\d{3,4}p|4k|uhd|hdr10\+?|hdr|dv|bluray|blu.ray|remux|web.dl|webrip|hdtv|dvdrip|xvid|x264|x265|hevc|h264|h265|aac|dts(?:-hd)?|dolby|atmos|truehd|ddp?\d(?:\.\d)?|multi|complete|proper|repack|extended|theatrical|directors.cut|lostfilm|rartv|eztv|tgx)\b.*/gi,
      "",
    )
    .replace(/\b(?:rus|ita|eng|french|latino|dual|dub)\b/gi, " ")
    .replace(/\s+tv$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanTvTitle(s: string): string {
  return s
    .replace(/\s+\((?:19|20)\d{2}\)/g, "")
    .replace(/\b[Ss]eason\s+\d{1,2}\b\s*$/g, "")
    .replace(/\b[Ss]eason\b\s*$/g, "")
    .replace(/\s+(?:19|20)\d{2}$/, "")
    .replace(/[^\x00-\x7F]+/g, "")
    .replace(/\s*[-–—]\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function searchTMDB(
  title: string,
  year: string | null,
  mediaType: "movie" | "tv",
  tmdbKey: string,
): Promise<TmdbMatch | null> {
  const buildQueryVariants = (rawTitle: string): string[] => {
    const queries = new Set<string>();
    const base = rawTitle.trim();
    if (base) queries.add(base);

    if (/\band\b/i.test(base)) queries.add(base.replace(/\band\b/gi, "&"));
    if (base.includes("&")) queries.add(base.replace(/\s*&\s*/g, " and "));

    queries.add(
      base.replace(
        /\b([A-Za-z])\s+([A-Za-z])(\s+([A-Za-z]))?\b/g,
        (_, a, b, _grp, c) => (c ? `${a}.${b}.${c}.` : `${a}.${b}.`),
      ),
    );

    queries.add(base.replace(/[']/g, ""));

    if (/^ncis(?:\s+\d{4})?$/i.test(base)) queries.add("NCIS");

    return [...queries].filter(Boolean);
  };

  const doSearch = async (
    query: string,
    includeYear: boolean,
    type: "movie" | "tv",
  ) => {
    const params = new URLSearchParams({ query, api_key: tmdbKey });
    if (includeYear && year) {
      params.set(type === "movie" ? "year" : "first_air_date_year", year);
    }
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${type}?${params}`,
    );
    const data = await res.json();
    return data.results?.[0] ?? null;
  };

  const tryType = async (type: "movie" | "tv"): Promise<TmdbMatch | null> => {
    const queries = buildQueryVariants(title);

    for (const query of queries) {
      const result = await doSearch(query, true, type);
      if (result)
        return {
          id: result.id,
          title: result.title ?? result.name,
          mediaType: type,
        };
    }

    for (const query of queries) {
      const result = await doSearch(query, false, type);
      if (result)
        return {
          id: result.id,
          title: result.title ?? result.name,
          mediaType: type,
        };
    }

    return null;
  };

  const preferred = await tryType(mediaType);
  if (preferred) return preferred;

  const fallbackType = mediaType === "movie" ? "tv" : "movie";
  return tryType(fallbackType);
}

export async function POST() {
  const session = await getSession();
  if (session.role !== "admin")
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
    });

  const db = await openDb();
  
  // Ensure sync tracking table exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS synced_torrents (
      torrent_id TEXT PRIMARY KEY,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const settings = await db.get(
    "SELECT rd_token, torbox_token, debrid_provider, tmdb_key, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, jellyfin_url, jellyfin_token, jellyfin_lib_id, jellyfin_tv_lib_id FROM settings WHERE id = 1",
  );

  const provider: "realdebrid" | "torbox" = settings?.debrid_provider || "realdebrid";
  const token = provider === "torbox" ? settings?.torbox_token : settings?.rd_token;

  if (!token)
    return new Response(JSON.stringify({ error: `${provider.toUpperCase()} token not configured` }), {
      status: 400,
    });

  if (!settings?.tmdb_key)
    return new Response(JSON.stringify({ error: "TMDB key not configured" }), {
      status: 400,
    });

  const encoder = new TextEncoder();
  const send = (ctrl: ReadableStreamDefaultController, data: object) =>
    ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  const stream = new ReadableStream({
    async start(ctrl) {
      try {
        let allTorrents: any[] = [];

        if (provider === "realdebrid") {
          const torrentsRes = await fetch(
            "https://api.real-debrid.com/rest/1.0/torrents?limit=2500",
            { headers: { Authorization: `Bearer ${token}` } },
          );
          allTorrents = await torrentsRes.json();
        } else {
          // TorBox API integration
          const torrentsRes = await fetch("https://api.torbox.app/v1/api/torrents/mylist", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const torboxData = await torrentsRes.json();
          allTorrents = torboxData?.data ?? [];
        }

        const downloaded = allTorrents.filter(
          (t) => t.status === "downloaded" || t.download_state === "completed" || t.progress === 100
        );

        send(ctrl, { type: "total", count: downloaded.length });

        let synced = 0,
          skipped = 0,
          failed = 0;
        const syncedMediaTypes = new Set<"movie" | "tv">();

        for (let i = 0; i < downloaded.length; i++) {
          const torrent = downloaded[i];
          const torrentId = String(torrent.id);

          // Fast DB cache check: Skip already synced items
          const existing = await db.get(
            "SELECT torrent_id FROM synced_torrents WHERE torrent_id = ?",
            [torrentId],
          );

          if (existing) {
            skipped++;
            send(ctrl, {
              type: "progress",
              current: i + 1,
              total: downloaded.length,
            });
            continue;
          }

          try {
            let infoData: { filename: string; files: RDFile[] };

            if (provider === "realdebrid") {
              const infoRes = await fetch(
                `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              infoData = await infoRes.json();
            } else {
              // Standardize TorBox payload structure to match RDFile
              infoData = {
                filename: torrent.name,
                files: (torrent.files ?? []).map((f: any, idx: number) => ({
                  id: idx,
                  path: f.name || f.path,
                  bytes: f.size ?? 0,
                  selected: 1,
                })),
              };
            }

            if (
              /\b(collection|saga|pack|anthology|trilogy|quadrilogy|franchise|universe)\b/i.test(
                infoData.filename,
              ) ||
              /\b\d+(\s*[,&]\s*\d+){2,}\b/.test(infoData.filename)
            ) {
              skipped++;
              send(ctrl, {
                type: "item",
                status: "skipped",
                filename: infoData.filename,
                reason: "Multi-title collection — skipped",
              });
              send(ctrl, {
                type: "progress",
                current: i + 1,
                total: downloaded.length,
              });
              continue;
            }

            const parsed = parseTorrentName(infoData.filename);
            const match = await searchTMDB(
              parsed.title,
              parsed.year,
              parsed.mediaType,
              settings.tmdb_key,
            );

            if (!match) {
              skipped++;
              send(ctrl, {
                type: "item",
                status: "skipped",
                filename: infoData.filename,
                reason: "No TMDB match",
              });
            } else {
              const { plex: plexPaths, jellyfin: jellyfinPaths } = await createSymlinks({
                infoData,
                title: match.title,
                tmdbId: String(match.id),
                mediaType: match.mediaType,
                season: parsed.season,
                tmdbKey: settings.tmdb_key,
                provider,
              });

              // Mark in DB as successfully processed
              await db.run(
                "INSERT OR REPLACE INTO synced_torrents (torrent_id) VALUES (?)",
                [torrentId],
              );

              synced++;
              syncedMediaTypes.add(match.mediaType);
              send(ctrl, {
                type: "item",
                status: "synced",
                filename: infoData.filename,
                title: match.title,
                plexCount: plexPaths.length,
                jellyfinCount: jellyfinPaths.length,
              });
            }
          } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : "Unknown error";
            send(ctrl, {
              type: "item",
              status: "failed",
              filename: torrent.name || torrent.filename,
              reason: msg,
            });
          }

          send(ctrl, {
            type: "progress",
            current: i + 1,
            total: downloaded.length,
          });
          await new Promise((r) => setTimeout(r, 100));
        }

        // Trigger library scans for both services
        const plexSectionIds: string[] = [];
        const jellyfinLibraries: string[] = [];

        if (syncedMediaTypes.has("movie")) {
          if (settings.plex_lib_id) plexSectionIds.push(settings.plex_lib_id);
          if (settings.jellyfin_lib_id) jellyfinLibraries.push(settings.jellyfin_lib_id);
        }
        if (syncedMediaTypes.has("tv")) {
          if (settings.plex_tv_lib_id) plexSectionIds.push(settings.plex_tv_lib_id);
          if (settings.jellyfin_tv_lib_id) jellyfinLibraries.push(settings.jellyfin_tv_lib_id);
        }

        const scansTriggered: string[] = [];

        // Plex Library Refresh
        if (settings.plex_url && settings.plex_token && plexSectionIds.length > 0) {
          try {
            await Promise.all(
              plexSectionIds.map((sectionId: string) =>
                fetch(
                  `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
                ),
              ),
            );
            scansTriggered.push("Plex");
            send(ctrl, { type: "scan", service: "Plex", sections: plexSectionIds });
          } catch (e) {
            console.error("Plex refresh failed:", e);
          }
        }

        // Jellyfin Library Refresh
        if (settings.jellyfin_url && settings.jellyfin_token && jellyfinLibraries.length > 0) {
          try {
            for (const libId of jellyfinLibraries) {
              await fetch(
                `${settings.jellyfin_url}/Items/${libId}/Refresh?Recursive=true`,
                {
                  method: "POST",
                  headers: {
                    "X-Emby-Token": settings.jellyfin_token,
                  },
                },
              );
            }
            scansTriggered.push("Jellyfin");
            send(ctrl, { type: "scan", service: "Jellyfin", libraries: jellyfinLibraries });
          } catch (e) {
            console.error("Jellyfin refresh failed:", e);
          }
        }

        send(ctrl, {
          type: "done",
          synced,
          skipped,
          failed,
          plexRefreshed: plexSectionIds.length > 0,
          jellyfinRefreshed: jellyfinLibraries.length > 0,
          scansTriggered,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        send(ctrl, { type: "error", message: msg });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}