import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

type UpcomingEpisode = {
  show_id: string;
  show_name: string;
  poster_path: string | null;
  season_number: number;
  episode_number: number;
  episode_name: string;
  air_date: string;
  tmdb_id: string;
};

type TmdbNextEpisode = {
  air_date?: string;
  episode_number?: number;
  name?: string;
  season_number?: number;
};

type TmdbTvDetails = {
  id: number;
  name?: string;
  poster_path?: string | null;
  next_episode_to_air?: TmdbNextEpisode | null;
};

type PlexGuid = { id?: string };
type PlexShow = { Guid?: PlexGuid[] };

let cache: { data: { results: UpcomingEpisode[] }; timestamp: number } | null =
  null;
const CACHE_TTL = 30 * 60 * 1000;
const UPCOMING_WINDOW_DAYS = 60;

function isDateWithinWindow(dateString: string): boolean {
  const today = new Date();
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + UPCOMING_WINDOW_DAYS);

  const candidate = new Date(`${dateString}T00:00:00.000Z`);
  return candidate >= start && candidate <= end;
}

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const db = await openDb();
    const settings = await db.get(
      "SELECT plex_url, plex_token, plex_tv_lib_id, tmdb_key FROM settings WHERE id = 1",
    );

    if (
      !settings?.plex_url ||
      !settings?.plex_token ||
      !settings?.plex_tv_lib_id ||
      !settings?.tmdb_key
    ) {
      return NextResponse.json({ results: [] });
    }

    const plexRes = await fetch(
      `${settings.plex_url}/library/sections/${settings.plex_tv_lib_id}/all?X-Plex-Token=${settings.plex_token}&includeGuids=1`,
      { headers: { Accept: "application/json" } },
    );

    if (!plexRes.ok) throw new Error("Plex TV library fetch failed");

    const plexData = await plexRes.json();
    const allShows = (plexData.MediaContainer?.Metadata || []) as PlexShow[];

    const tmdbIds = allShows
      .map((show) => {
        const tmdbGuid = (show.Guid || []).find(
          (g) => !!g.id && g.id.startsWith("tmdb://"),
        );
        return tmdbGuid?.id ? tmdbGuid.id.replace("tmdb://", "") : null;
      })
      .filter((id): id is string => Boolean(id));

    const uniqueTmdbIds: string[] = [...new Set(tmdbIds)];

    const upcomingResults = await Promise.all(
      uniqueTmdbIds.map(async (tmdbId: string) => {
        try {
          const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${settings.tmdb_key}`,
          );
          if (!tmdbRes.ok) return null;

          const showData = (await tmdbRes.json()) as TmdbTvDetails;
          const nextEpisode = showData.next_episode_to_air;

          if (!nextEpisode?.air_date) return null;
          if (!isDateWithinWindow(nextEpisode.air_date)) return null;

          return {
            show_id: tmdbId,
            show_name: showData.name || "Unknown",
            poster_path: showData.poster_path || null,
            season_number: nextEpisode.season_number || 0,
            episode_number: nextEpisode.episode_number || 0,
            episode_name: nextEpisode.name || "Untitled Episode",
            air_date: nextEpisode.air_date,
            tmdb_id: tmdbId,
          } satisfies UpcomingEpisode;
        } catch {
          return null;
        }
      }),
    );

    const results = upcomingResults
      .filter((item): item is UpcomingEpisode => item !== null)
      .sort((a, b) => a.air_date.localeCompare(b.air_date));

    const responseData = { results };
    cache = { data: responseData, timestamp: Date.now() };

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Upcoming Episodes Error:", message);
    return NextResponse.json({ results: [] });
  }
}
