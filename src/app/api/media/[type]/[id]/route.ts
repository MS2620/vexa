import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET(req: Request, context: { params: Promise<{ type: string; id: string }> }) {
  try {
    const { type, id } = await context.params;
    const db = await openDb();
    const settings = await db.get(
      'SELECT tmdb_key, plex_url, plex_token, plex_lib_id, plex_tv_lib_id FROM settings WHERE id = 1'
    );

    if (!settings?.tmdb_key) return NextResponse.json({ error: 'No TMDB key' }, { status: 400 });

    // 1. Fetch full TMDB details
    const [detailRes, creditsRes, keywordsRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${settings.tmdb_key}&append_to_response=external_ids`),
      fetch(`https://api.themoviedb.org/3/${type}/${id}/credits?api_key=${settings.tmdb_key}`),
      fetch(`https://api.themoviedb.org/3/${type}/${id}/keywords?api_key=${settings.tmdb_key}`)
    ]);

    const [detail, credits, keywordsData] = await Promise.all([
      detailRes.json(),
      creditsRes.json(),
      keywordsRes.json()
    ]);

    const keywords = keywordsData.keywords || keywordsData.results || [];

    // 2. Check Plex availability
    let plexAvailability: Record<string, string> = {};

    if (settings.plex_url && settings.plex_token) {
      try {
        const libId = type === 'movie' ? settings.plex_lib_id : settings.plex_tv_lib_id;
        const plexRes = await fetch(
          `${settings.plex_url}/library/sections/${libId}/all?includeGuids=1&X-Plex-Token=${settings.plex_token}`,
          { headers: { Accept: 'application/json' } }
        );
        const plexData = await plexRes.json();
        const items = plexData.MediaContainer?.Metadata || [];

        // For TV: map each season against what's in Plex
        if (type === 'tv') {
          // Find matching show by TMDB guid
          const matchedShow = items.find((item: any) => {
            const guids = item.Guid || [];
            return guids.some((g: any) => g.id === `tmdb://${id}`);
          });

          if (matchedShow) {
            // Fetch seasons for this show
            const seasonsRes = await fetch(
              `${settings.plex_url}/library/metadata/${matchedShow.ratingKey}/children?X-Plex-Token=${settings.plex_token}`,
              { headers: { Accept: 'application/json' } }
            );
            const seasonsData = await seasonsRes.json();
            const plexSeasons = seasonsData.MediaContainer?.Metadata || [];

            for (const season of detail.seasons || []) {
              const plexSeason = plexSeasons.find((ps: any) =>
                ps.index === season.season_number
              );

              if (!plexSeason) {
                plexAvailability[season.season_number] = 'unavailable';
              } else {
                // Compare leaf count (episodes available vs total)
                const available = plexSeason.leafCount || 0;
                const total = season.episode_count || 0;
                if (available >= total) {
                  plexAvailability[season.season_number] = 'available';
                } else if (available > 0) {
                  plexAvailability[season.season_number] = 'partial';
                } else {
                  plexAvailability[season.season_number] = 'unavailable';
                }
              }
            }
          }
        } else {
          // For movies: just check if it exists
          const found = items.find((item: any) => {
            const guids = item.Guid || [];
            return guids.some((g: any) => g.id === `tmdb://${id}`);
          });
          plexAvailability['movie'] = found ? 'available' : 'unavailable';
        }
      } catch (e) {
        console.error('Plex check failed:', e);
      }
    }

    return NextResponse.json({
      detail,
      credits,
      keywords,
      plexAvailability
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
