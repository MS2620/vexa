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

// Extract title, year, type, and season from a raw torrent filename.
// Handles the most common naming conventions — not perfect, but covers >90% of real-world cases.
function parseTorrentName(filename: string): ParsedName {
  // Strip common video file extensions (e.g. "Shrek (2001).mkv")
  let s = filename.replace(/\.(mkv|mp4|avi|mov|wmv|m4v|ts|iso)$/i, "");

  // Strip site watermark prefixes: "[ Torrent911.si ]", "[www.site.com]"
  s = s.replace(/^\[[\w\s.:-]+\]\s*/, "");

  // Normalise dots/underscores to spaces
  s = s.replace(/[._]/g, " ").trim();

  // Strip bracketed quality/language tags like [2160p], [HDR], [ger, eng] — but not bare years
  s = s.replace(/\[(?!\d{4}\])[^\]]*\]/g, " ");

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, " ").trim();

  // TV — episode marker: ShowName S01E01
  const sxex = s.match(/^(.+?)\s+[Ss](\d{1,2})[Ee]\d{1,2}/i);
  if (sxex) {
    // Strip a trailing year that may have been captured in the show title:
    // bare year (e.g. "S W A T 2017") or parenthesised (e.g. "The Blacklist (2013)")
    const tvTitle = cleanTitle(sxex[1])
      .replace(/\s+\((?:19|20)\d{2}\)$/, "")
      .replace(/\s+(?:19|20)\d{2}$/, "")
      .trim();
    return { title: tvTitle, year: null, mediaType: "tv", season: parseInt(sxex[2]) };
  }

  // TV — season pack: ShowName Season 2 / ShowName S02
  const pack = s.match(
    /^(.+?)\s+(?:[Ss]eason\s+(\d{1,2})|[Ss](\d{2})(?:\s|$))/i,
  );
  if (pack) {
    const season = parseInt(pack[2] ?? pack[3]);
    if (!isNaN(season)) {
      const tvTitle = cleanTitle(pack[1])
        .replace(/\s+\((?:19|20)\d{2}\)$/, "")
        .replace(/\s+(?:19|20)\d{2}$/, "")
        .trim();
      return { title: tvTitle, year: null, mediaType: "tv", season };
    }
  }

  // Movie — year inside parentheses, possibly with extra content: "Title (2001)" or "Title (2001 ITA-ENG)"
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

// Strip quality/codec/source tags that appear after the meaningful title part
function cleanTitle(s: string): string {
  return s
    .replace(
      /\b(4k|uhd|hdr|dv|bluray|blu.ray|remux|web.dl|webrip|hdtv|dvdrip|xvid|x264|x265|hevc|h264|h265|aac|dts|dolby|atmos|truehd|multi|complete|proper|repack|extended|theatrical|directors.cut)\b.*/gi,
      "",
    )
    .trim();
}

async function searchTMDB(
  title: string,
  year: string | null,
  mediaType: "movie" | "tv",
  tmdbKey: string,
): Promise<{ id: number; title: string } | null> {
  const doSearch = async (includeYear: boolean) => {
    const params = new URLSearchParams({ query: title, api_key: tmdbKey });
    if (includeYear && year) params.set("year", year);
    const res = await fetch(
      `https://api.themoviedb.org/3/search/${mediaType}?${params}`,
    );
    const data = await res.json();
    return data.results?.[0] ?? null;
  };

  // Try with year first, fall back to without year
  const result = (await doSearch(true)) ?? (await doSearch(false));
  if (!result) return null;
  return { id: result.id, title: result.title ?? result.name };
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
                mediaType: parsed.mediaType,
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
          // Pace requests to avoid hammering RD/TMDB APIs
          await new Promise((r) => setTimeout(r, 150));
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
