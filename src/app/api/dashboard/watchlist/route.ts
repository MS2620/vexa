import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

// Cache lives in server memory — persists between requests but resets on container restart
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  // Return cached result if still fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const db = await openDb();
    const settings = await db.get(
      'SELECT plex_url, plex_token, plex_tv_lib_id, tmdb_key FROM settings WHERE id = 1'
    );

    if (!settings?.plex_url || !settings?.plex_token || !settings?.plex_tv_lib_id) {
      return NextResponse.json({ results: [] });
    }

    // 1. Fetch ALL TV shows from the Plex TV library
    const plexRes = await fetch(
        `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/all?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
        { headers: { 'Accept': 'application/json' } }
      );
  

    if (!plexRes.ok) throw new Error("Plex TV library fetch failed");

    const plexData = await plexRes.json();
    const allShows = plexData.MediaContainer?.Metadata || [];

    // 2. Extract TMDB ID from each show's Plex Guid array
    const showsWithTmdbId = allShows.map((show: any) => {
      const guids = show.Guid || [];
      const tmdbGuid = guids.find((g: any) => g.id?.startsWith('tmdb://'));
      const tmdbId = tmdbGuid ? tmdbGuid.id.replace('tmdb://', '') : null;
      return { ...show, tmdbId };
    }).filter((show: any) => show.tmdbId);

    // 3. Check TMDB status for each show in parallel
    const results = await Promise.all(
      showsWithTmdbId.map(async (show: any) => {
        try {
          const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/tv/${show.tmdbId}?api_key=${settings.tmdb_key}`
          );
          const tmdbData = await tmdbRes.json();

          // Only keep shows actively returning/airing
          if (tmdbData.status !== 'Returning Series') return null;

          return {
            id: show.tmdbId,
            name: tmdbData.name,
            media_type: 'tv',
            poster_path: tmdbData.poster_path,
            first_air_date: tmdbData.first_air_date,
            status: tmdbData.status,
            isAvailable: true
          };
        } catch {
          return null;
        }
      })
    );

    // 4. Filter out nulls (ended/cancelled shows)
    const ongoingShows = results.filter(Boolean);

    // 5. Save to cache before returning
    const responseData = { results: ongoingShows };
    cache = { data: responseData, timestamp: Date.now() };

    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error("Watchlist Error:", error.message);
    return NextResponse.json({ results: [] });
  }
}
