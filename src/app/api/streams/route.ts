import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

const RESOLUTION_SCORE: Record<string, number> = {
  "2160p": 4,
  "4k": 4,
  uhd: 4,
  "1080p": 3,
  "720p": 2,
  "480p": 1,
};

interface Stream {
  infoHash?: string;
  name?: string;
  title?: string;
  [key: string]: unknown;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("tmdbId");
  const type = searchParams.get("type");
  const s = searchParams.get("s") || "1";
  const e = searchParams.get("e") || "1";

  const db = await openDb();
  const settings = await db.get(
    "SELECT tmdb_key, preferred_resolution, preferred_language FROM settings WHERE id = 1",
  );

  const preferredRes = (
    settings?.preferred_resolution || "1080p"
  ).toLowerCase();
  const preferredLang = (settings?.preferred_language || "en").toLowerCase();

  try {
    // 1. Get IMDB ID from TMDB
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/external_ids?api_key=${settings.tmdb_key}`,
    );
    const tmdbData = await tmdbRes.json();
    const imdbId = tmdbData.imdb_id;
    if (!imdbId) throw new Error("No IMDB ID found");

    // 2. Query Torrentio
    const torrentioUrl =
      type === "movie"
        ? `https://torrentio.strem.fun/stream/movie/${imdbId}.json`
        : `https://torrentio.strem.fun/stream/series/${imdbId}:${s}:${e}.json`;

    const torrentioRes = await fetch(torrentioUrl);
    const torrentioData = await torrentioRes.json();
    const rawStreams = torrentioData.streams || [];

    // 3. Filter out blocklisted hashes
    const blocklisted = await db.all<{ info_hash: string }[]>(
      "SELECT info_hash FROM blocklist",
    );
    const blockedSet = new Set(
      blocklisted.map((b) => b.info_hash.toLowerCase()),
    );

    const streams = rawStreams.filter(
      (s: Stream) => s.infoHash && !blockedSet.has(s.infoHash.toLowerCase()),
    );

    // 4. Score and sort each stream by preferences
    const scored: (Stream & { _score: number; _resScore: number })[] =
      streams.map((stream: Stream) => {
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

        const preferredResScore = RESOLUTION_SCORE[preferredRes] || 3;
        const resMatch =
          resScore === preferredResScore
            ? 100
            : Math.max(0, 50 - Math.abs(resScore - preferredResScore) * 20);

        const langMatch =
          combined.includes(preferredLang) ||
          (preferredLang === "en" &&
            !combined.match(
              /\b(french|german|spanish|italian|portuguese|japanese|korean|chinese|hindi|arabic|dubbed)\b/,
            ))
            ? 50
            : 0;

        const cachedBonus =
          combined.includes("[rd+]") || combined.includes("[rd]") ? 200 : 0;

        return {
          ...stream,
          _score: resMatch + langMatch + cachedBonus,
          _resScore: resScore,
        };
      });

    scored.sort((a, b) => b._score - a._score);

    return NextResponse.json({ streams: scored });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
