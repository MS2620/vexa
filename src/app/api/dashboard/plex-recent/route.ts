import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

type TmdbCacheEntry = {
  data: any;
  timestamp: number;
};

const tmdbDetailsCache = new Map<string, TmdbCacheEntry>();
const TMDB_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

async function getTmdbDetailsCached(
  tmdbKey: string,
  mediaType: "movie" | "tv",
  tmdbId: string,
) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = tmdbDetailsCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < TMDB_CACHE_TTL) {
    return cached.data;
  }

  const tmdbRes = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${tmdbKey}`,
  );

  if (!tmdbRes.ok) {
    throw new Error(`TMDB fetch failed for ${tmdbId}`);
  }

  const tmdbData = await tmdbRes.json();
  tmdbDetailsCache.set(cacheKey, { data: tmdbData, timestamp: Date.now() });
  return tmdbData;
}

export async function GET() {
  try {
    const db = await openDb();
    const settings = await db.get(
      "SELECT plex_url, plex_token, plex_lib_id, plex_tv_lib_id, tmdb_key FROM settings WHERE id = 1",
    );

    if (!settings?.plex_url || !settings?.plex_token) {
      return NextResponse.json({ results: [] });
    }

    // Fetch from both Movie and TV libraries simultaneously
    const [movieRes, tvRes] = await Promise.all([
      settings.plex_lib_id
        ? fetch(
            `${settings.plex_url}/library/sections/${settings.plex_lib_id}/recentlyAdded?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
            { headers: { Accept: "application/json" } },
          )
        : Promise.resolve(null),
      settings.plex_tv_lib_id
        ? fetch(
            `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/recentlyAdded?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
            { headers: { Accept: "application/json" } },
          )
        : Promise.resolve(null),
    ]);

    const [movieData, tvData] = await Promise.all([
      movieRes?.ok ? movieRes.json() : Promise.resolve({}),
      tvRes?.ok ? tvRes.json() : Promise.resolve({}),
    ]);

    const movieItems = movieData.MediaContainer?.Metadata || [];
    const tvItems = tvData.MediaContainer?.Metadata || [];
    const allItems = [...movieItems, ...tvItems];

    const baseItems = allItems
      .map((item: any) => {
        const guids = item.Guid || [];
        const tmdbGuid = guids.find((g: any) => g.id?.startsWith("tmdb://"));
        const tmdbId = tmdbGuid ? tmdbGuid.id.replace("tmdb://", "") : null;

        if (!tmdbId) return null;

        return {
          tmdbId,
          mediaType: item.type === "movie" ? "movie" : "tv",
          fallbackTitle: item.title,
          fallbackYear: item.year?.toString() || "",
        };
      })
      .filter(Boolean)
      .slice(0, 20);

    const results = await Promise.all(
      baseItems.map(async (item: any) => {
        if (!settings.tmdb_key) {
          return {
            id: item.tmdbId,
            title: item.fallbackTitle,
            name: item.fallbackTitle,
            media_type: item.mediaType,
            release_date: item.mediaType === "movie" ? item.fallbackYear : "",
            first_air_date:
              item.mediaType !== "movie" ? item.fallbackYear : undefined,
            poster_path: null,
            isPlex: true,
            isAvailable: true,
          };
        }

        try {
          const tmdbData = await getTmdbDetailsCached(
            settings.tmdb_key,
            item.mediaType,
            item.tmdbId,
          );

          return {
            id: item.tmdbId,
            title: tmdbData.title || item.fallbackTitle,
            name: tmdbData.name || tmdbData.title || item.fallbackTitle,
            media_type: item.mediaType,
            release_date: tmdbData.release_date || item.fallbackYear,
            first_air_date: tmdbData.first_air_date || item.fallbackYear,
            poster_path: tmdbData.poster_path || null,
            isPlex: true,
            isAvailable: true,
          };
        } catch {
          return {
            id: item.tmdbId,
            title: item.fallbackTitle,
            name: item.fallbackTitle,
            media_type: item.mediaType,
            release_date: item.mediaType === "movie" ? item.fallbackYear : "",
            first_air_date:
              item.mediaType !== "movie" ? item.fallbackYear : undefined,
            poster_path: null,
            isPlex: true,
            isAvailable: true,
          };
        }
      }),
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Plex Recent Error:", error.message);
    return NextResponse.json({ results: [] });
  }
}
