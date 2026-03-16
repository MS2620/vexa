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

// Extract title, year, type, and season from a raw torrent filename.
// Handles the most common naming conventions — not perfect, but covers >90% of real-world cases.
function parseTorrentName(filename: string): ParsedName {
  // Strip common video file extensions (e.g. "Shrek (2001).mkv")
  let s = filename.replace(/\.(mkv|mp4|avi|mov|wmv|m4v|ts|iso)$/i, "");

  // Strip site watermark prefixes in square brackets: "[ Torrent911.si ]", "[www.site.com]"
  s = s.replace(/^\[[\w\s.:-]+\]\s*/, "");

  // Strip URL-style prefixes without brackets: "www.UIndex.org - "
  // Keep this strict to avoid eating normal dotted scene names before tokens like "WEB-DL".
  s = s.replace(/^(?:https?:\/\/)?www\.[\w.-]+\.[a-z]{2,6}\s*[-–—|]\s*/i, "");

  // Strip Chinese/full-width bracket prefixes: "【高清剧集网 www.site.com】"
  s = s.replace(/^【[^】]*】\s*/, "");

  // Normalise dots/underscores to spaces
  s = s.replace(/[._]/g, " ").trim();

  // Strip bracketed quality/language tags like [2160p], [HDR], [ger, eng] — but not bare years
  s = s.replace(/\[(?!\d{4}\])[^\]]*\]/g, " ");

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ").trim();

  // TV — S01-S04 multi-season range: "ShowName S01-S04"
  const multiSeason = s.match(/^(.+?)\s+[Ss](\d{1,2})-[Ss]\d{1,2}/i);
  if (multiSeason)
    return buildTvParsedName(multiSeason[1], parseInt(multiSeason[2]));

  // TV — episode marker: ShowName S01E01
  const sxex = s.match(/^(.+?)\s+[Ss](\d{1,2})[Ee]\d{1,2}/i);
  if (sxex) return buildTvParsedName(sxex[1], parseInt(sxex[2]));

  // TV — (Season N) or (S03) in parentheses: "The Rookie (Season 3)", "The Blacklist (S03)"
  const parenSeason = s.match(
    /^(.+?)\s+\((?:[Ss]eason\s+(\d{1,2})|[Ss](\d{2}))\)/i,
  );
  if (parenSeason) {
    const season = parseInt(parenSeason[2] ?? parenSeason[3]);
    if (!isNaN(season)) return buildTvParsedName(parenSeason[1], season);
  }

  // TV — bare season pack: ShowName Season 2 / ShowName S02
  const pack = s.match(
    /^(.+?)\s+(?:[Ss]eason\s+(\d{1,2})|[Ss](\d{2})(?:\s|$))/i,
  );
  if (pack) {
    const season = parseInt(pack[2] ?? pack[3]);
    if (!isNaN(season)) return buildTvParsedName(pack[1], season);
  }

  // TV — explicit "Season S01" form: "NCIS 2003 Season S01"
  const seasonWithSPrefix = s.match(
    /^(.+?)\s+[Ss]eason\s+[Ss](\d{1,2})(?:\s|$)/i,
  );
  if (seasonWithSPrefix) {
    const season = parseInt(seasonWithSPrefix[2]);
    if (!isNaN(season)) return buildTvParsedName(seasonWithSPrefix[1], season);
  }

  // Movie — year in square brackets: "Despicable Me 4 [2024]"
  const withYearSquare = s.match(/^(.+?)\s+\[((?:19|20)\d{2})\]/);
  if (withYearSquare)
    return {
      title: cleanTitle(withYearSquare[1]),
      year: withYearSquare[2],
      mediaType: "movie",
      season: null,
    };

  // Movie — year inside parentheses: "Title (2001)" or "Title (2001 ITA-ENG)"
  const withYearParen = s.match(/^(.+?)\s+\(((?:19|20)\d{2})[^)]*\)/);
  if (withYearParen)
    return {
      title: cleanTitle(withYearParen[1]),
      year: withYearParen[2],
      mediaType: "movie",
      season: null,
    };

  // Movie — bare year: "Title 2001 BluRay…"
  const withYear = s.match(/^(.+?)\s+((?:19|20)\d{2})(?:\s|$)/);
  if (withYear)
    return {
      title: cleanTitle(withYear[1]),
      year: withYear[2],
      mediaType: "movie",
      season: null,
    };

  // Fallback — treat as movie, no year
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

// Strip quality/codec/source tags that appear after the meaningful title part
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

// Additional cleanup for TV show titles: strips absorbed years, "Season" keyword, dashes
function cleanTvTitle(s: string): string {
  return s
    .replace(/\s+\((?:19|20)\d{2}\)/g, "") // strip (year) anywhere in title
    .replace(/\b[Ss]eason\s+\d{1,2}\b\s*$/g, "") // strip trailing "Season 1"
    .replace(/\b[Ss]eason\b\s*$/g, "") // strip trailing "Season" BEFORE year strip
    .replace(/\s+(?:19|20)\d{2}$/, "") // then strip trailing bare year
    .replace(/[^\x00-\x7F]+/g, "") // strip non-ASCII (e.g. Chinese chars)
    .replace(/\s*[-–—]\s*$/, "") // strip trailing " - "
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

    // "Law and Order" <-> "Law & Order"
    if (/\band\b/i.test(base)) queries.add(base.replace(/\band\b/gi, "&"));
    if (base.includes("&")) queries.add(base.replace(/\s*&\s*/g, " and "));

    // "Chicago P D" -> "Chicago P.D."
    queries.add(
      base.replace(
        /\b([A-Za-z])\s+([A-Za-z])(\s+([A-Za-z]))?\b/g,
        (_, a, b, _grp, c) => {
          return c ? `${a}.${b}.${c}.` : `${a}.${b}.`;
        },
      ),
    );

    // Remove apostrophes for alternate matching
    queries.add(base.replace(/[’']/g, ""));

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

  const queries = buildQueryVariants(title);
  const preferred = await tryType(mediaType);
  if (preferred) return preferred;

  // Last resort: retry on the opposite media type in case parsing guessed wrong.
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
  const settings = await db.get(
    "SELECT rd_token, tmdb_key FROM settings WHERE id = 1",
  );

  if (!settings?.rd_token)
    return new Response(JSON.stringify({ error: "RD token not configured" }), {
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
        const torrentsRes = await fetch(
          "https://api.real-debrid.com/rest/1.0/torrents?limit=2500",
          { headers: { Authorization: `Bearer ${settings.rd_token}` } },
        );
        const allTorrents: any[] = await torrentsRes.json();
        const downloaded = allTorrents.filter((t) => t.status === "downloaded");

        send(ctrl, { type: "total", count: downloaded.length });

        let synced = 0,
          skipped = 0,
          failed = 0;

        for (let i = 0; i < downloaded.length; i++) {
          const torrent = downloaded[i];
          try {
            const infoRes = await fetch(
              `https://api.real-debrid.com/rest/1.0/torrents/info/${torrent.id}`,
              { headers: { Authorization: `Bearer ${settings.rd_token}` } },
            );
            const infoData: { filename: string; files: RDFile[] } =
              await infoRes.json();

            // Skip multi-title packs — can't map to a single TMDB entry
            if (
              /\b(collection|saga|pack|anthology|trilogy|quadrilogy|franchise|universe)\b/i.test(
                infoData.filename,
              ) ||
              /\b\d+(\s*[,&]\s*\d+){2,}\b/.test(infoData.filename) // e.g. "Shrek 1,2,3,4" (3+ numbers)
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
              await createSymlinks({
                infoData,
                title: match.title,
                tmdbId: String(match.id),
                mediaType: match.mediaType,
                season: parsed.season,
                tmdbKey: settings.tmdb_key,
              });
              synced++;
              send(ctrl, {
                type: "item",
                status: "synced",
                filename: infoData.filename,
                title: match.title,
              });
            }
          } catch (e: unknown) {
            failed++;
            const msg = e instanceof Error ? e.message : "Unknown error";
            send(ctrl, {
              type: "item",
              status: "failed",
              filename: torrent.filename,
              reason: msg,
            });
          }

          send(ctrl, {
            type: "progress",
            current: i + 1,
            total: downloaded.length,
          });
          // Pace requests to avoid hammering RD/TMDB APIs (TMDB allows ~40 req/10s)
          await new Promise((r) => setTimeout(r, 300));
        }

        send(ctrl, { type: "done", synced, skipped, failed });
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
