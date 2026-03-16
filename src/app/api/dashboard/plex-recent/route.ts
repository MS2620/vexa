import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await openDb();
    const settings = await db.get(
      'SELECT plex_url, plex_token, plex_lib_id, plex_tv_lib_id FROM settings WHERE id = 1'
    );

    if (!settings?.plex_url || !settings?.plex_token) {
      return NextResponse.json({ results: [] });
    }

    // Fetch from both Movie and TV libraries simultaneously
    const [movieRes, tvRes] = await Promise.all([
      settings.plex_lib_id ? fetch(
        `${settings.plex_url}/library/sections/${settings.plex_lib_id}/recentlyAdded?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
        { headers: { 'Accept': 'application/json' } }
      ) : Promise.resolve(null),
      settings.plex_tv_lib_id ? fetch(
        `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/recentlyAdded?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
        { headers: { 'Accept': 'application/json' } }
      ) : Promise.resolve(null),
    ]);

    const [movieData, tvData] = await Promise.all([
      movieRes?.ok ? movieRes.json() : Promise.resolve({}),
      tvRes?.ok ? tvRes.json() : Promise.resolve({}),
    ]);

    const movieItems = movieData.MediaContainer?.Metadata || [];
    const tvItems = tvData.MediaContainer?.Metadata || [];
    const allItems = [...movieItems, ...tvItems];

    const results = allItems
      .map((item: any) => {
        // Extract TMDB ID from the Guid array
        const guids = item.Guid || [];
        const tmdbGuid = guids.find((g: any) => g.id?.startsWith('tmdb://'));
        const tmdbId = tmdbGuid ? tmdbGuid.id.replace('tmdb://', '') : null;

        // Skip items where we can't find a TMDB ID
        if (!tmdbId) return null;

        return {
          id: tmdbId, // Use TMDB ID so navigation works correctly
          title: item.title,
          name: item.title,
          media_type: item.type === 'movie' ? 'movie' : 'tv',
          release_date: item.year?.toString() || '',
          first_air_date: item.type !== 'movie' ? item.year?.toString() : undefined,
          poster_path: item.thumb
            ? `${settings.plex_url}${item.thumb}?X-Plex-Token=${settings.plex_token}`
            : null,
          isPlex: true,
          isAvailable: true
        };
      })
      .filter(Boolean)
      .slice(0, 20); // Limit to 20 most recent

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Plex Recent Error:', error.message);
    return NextResponse.json({ results: [] });
  }
}
