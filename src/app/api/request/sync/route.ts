import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function POST() {
  try {
    const db = await openDb();
    const settings = await db.get(
      'SELECT plex_url, plex_token, plex_lib_id, plex_tv_lib_id FROM settings WHERE id = 1'
    );

    if (!settings?.plex_url) return NextResponse.json({ updated: 0 });

    const pendingRequests = await db.all(
      `SELECT * FROM requests WHERE status = 'Requested'`
    );

    if (pendingRequests.length === 0) return NextResponse.json({ updated: 0 });

    // Fetch both libraries with GUIDs
    const [movieRes, tvRes] = await Promise.all([
      settings.plex_lib_id ? fetch(
        `${settings.plex_url}/library/sections/${settings.plex_lib_id}/all?includeGuids=1&X-Plex-Token=${settings.plex_token}`,
        { headers: { Accept: 'application/json' } }
      ) : Promise.resolve(null),
      settings.plex_tv_lib_id ? fetch(
        `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/all?includeGuids=1&X-Plex-Token=${settings.plex_token}`,
        { headers: { Accept: 'application/json' } }
      ) : Promise.resolve(null),
    ]);

    const [movieData, tvData] = await Promise.all([
      movieRes?.ok ? movieRes.json() : Promise.resolve({}),
      tvRes?.ok ? tvRes.json() : Promise.resolve({}),
    ]);

    const plexMovies = movieData.MediaContainer?.Metadata || [];
    const plexShows = tvData.MediaContainer?.Metadata || [];

    // Build lookup Sets using BOTH tmdb ID and title (normalised lowercase)
    // This way we match even when GUIDs aren't returned
    const availableMovieTmdbIds = new Set(
      plexMovies.flatMap((item: any) =>
        (item.Guid || [])
          .filter((g: any) => g.id?.startsWith('tmdb://'))
          .map((g: any) => g.id.replace('tmdb://', ''))
      )
    );
    const availableMovieTitles = new Set(
      plexMovies.map((item: any) => item.title?.toLowerCase().trim())
    );

    const availableShowTmdbIds = new Set(
      plexShows.flatMap((item: any) =>
        (item.Guid || [])
          .filter((g: any) => g.id?.startsWith('tmdb://'))
          .map((g: any) => g.id.replace('tmdb://', ''))
      )
    );
    const availableShowTitles = new Set(
      plexShows.map((item: any) => item.title?.toLowerCase().trim())
    );

    let updated = 0;

    for (const req of pendingRequests) {
      const tmdbId = req.tmdb_id?.toString();
      const titleNorm = req.title?.toLowerCase().trim();

      let isAvailable = false;

      if (req.media_type === 'movie') {
        // Match by TMDB ID first, fall back to title
        isAvailable = availableMovieTmdbIds.has(tmdbId) || availableMovieTitles.has(titleNorm);
      } else {
        // Match by TMDB ID first, fall back to title
        isAvailable = availableShowTmdbIds.has(tmdbId) || availableShowTitles.has(titleNorm);
      }

      if (isAvailable) {
        await db.run(
          `UPDATE requests SET status = 'Available' WHERE id = ?`,
          [req.id]
        );
        updated++;
      }
    }

    console.log(`Sync complete: ${updated} requests marked Available`);
    return NextResponse.json({ updated });

  } catch (error: any) {
    console.error('Sync error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
