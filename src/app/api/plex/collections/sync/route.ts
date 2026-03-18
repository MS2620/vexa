import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { addLog } from "@/lib/logger";

type PlexGuid = { id?: string };
type PlexItem = {
  ratingKey?: string | number;
  title?: string;
  Guid?: PlexGuid[];
};

type CollectionGroup = {
  tmdbCollectionId: number;
  name: string;
  ratingKeys: Set<string>;
};

function getTmdbIdFromPlexGuids(guids: PlexGuid[] | undefined) {
  if (!Array.isArray(guids)) return null;

  const match = guids.find((guid) => guid?.id?.startsWith("tmdb://"));
  if (!match?.id) return null;

  return match.id.replace("tmdb://", "");
}

function toPlexUri(machineId: string, ratingKeys: string[]) {
  return `server://${machineId}/com.plexapp.plugins.library/library/metadata/${ratingKeys.join(",")}`;
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session.isLoggedIn || !session.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await openDb();
    const currentUser = await db.get<{ role?: string }>(
      "SELECT role FROM users WHERE username = ? LIMIT 1",
      [session.username],
    );

    const role = currentUser?.role || session.role || "user";
    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const settings = await db.get<{
      tmdb_key?: string;
      plex_url?: string;
      plex_token?: string;
      plex_lib_id?: string;
    }>(
      "SELECT tmdb_key, plex_url, plex_token, plex_lib_id FROM settings WHERE id = 1",
    );

    if (!settings?.plex_url || !settings?.plex_token || !settings?.plex_lib_id) {
      return NextResponse.json(
        { error: "Plex movie library is not configured" },
        { status: 400 },
      );
    }

    if (!settings.tmdb_key) {
      return NextResponse.json(
        { error: "TMDB API key is required for collection sync" },
        { status: 400 },
      );
    }

    const plexBase = settings.plex_url.replace(/\/$/, "");
    const token = settings.plex_token;
    const sectionId = settings.plex_lib_id;

    await addLog("info", "[collections] Starting Plex collection sync", {
      sectionId,
      startedBy: session.username,
    });

    const machineRes = await fetch(`${plexBase}/?X-Plex-Token=${token}`, {
      headers: { Accept: "application/json" },
    });

    const machineData = machineRes.ok ? await machineRes.json() : null;
    const machineId = machineData?.MediaContainer?.machineIdentifier as
      | string
      | undefined;

    if (!machineId) {
      return NextResponse.json(
        { error: "Could not resolve Plex machine identifier" },
        { status: 502 },
      );
    }

    const movieRes = await fetch(
      `${plexBase}/library/sections/${sectionId}/all?includeGuids=1&X-Plex-Token=${token}`,
      { headers: { Accept: "application/json" } },
    );

    if (!movieRes.ok) {
      return NextResponse.json(
        { error: "Failed to load Plex movie library" },
        { status: 502 },
      );
    }

    const movieData = await movieRes.json();
    const movies = (movieData?.MediaContainer?.Metadata || []) as PlexItem[];

    const collectionGroups = new Map<number, CollectionGroup>();

    let skippedNoTmdb = 0;
    let skippedNoCollection = 0;
    let tmdbFailures = 0;

    for (const movie of movies) {
      const ratingKey = String(movie.ratingKey || "").trim();
      if (!ratingKey) continue;

      const tmdbId = getTmdbIdFromPlexGuids(movie.Guid);
      if (!tmdbId) {
        skippedNoTmdb++;
        continue;
      }

      try {
        const tmdbRes = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${settings.tmdb_key}`,
        );

        if (!tmdbRes.ok) {
          tmdbFailures++;
          continue;
        }

        const tmdbMovie = await tmdbRes.json();
        const belongs = tmdbMovie?.belongs_to_collection as
          | { id?: number; name?: string }
          | null
          | undefined;

        if (!belongs?.id || !belongs?.name) {
          skippedNoCollection++;
          continue;
        }

        const existing = collectionGroups.get(belongs.id);
        if (existing) {
          existing.ratingKeys.add(ratingKey);
        } else {
          collectionGroups.set(belongs.id, {
            tmdbCollectionId: belongs.id,
            name: belongs.name,
            ratingKeys: new Set([ratingKey]),
          });
        }
      } catch {
        tmdbFailures++;
      }
    }

    const collectionRes = await fetch(
      `${plexBase}/library/sections/${sectionId}/collections?X-Plex-Token=${token}`,
      { headers: { Accept: "application/json" } },
    );

    const existingCollections = collectionRes.ok
      ? ((await collectionRes.json())?.MediaContainer?.Metadata || [])
      : [];

    const existingByTitle = new Map<
      string,
      { ratingKey?: string | number; title?: string }
    >();

    for (const collection of existingCollections) {
      const title = String(collection?.title || "").trim().toLowerCase();
      if (!title) continue;
      existingByTitle.set(title, collection);
    }

    let created = 0;
    let updated = 0;
    let plexFailures = 0;

    for (const group of collectionGroups.values()) {
      const ratingKeys = Array.from(group.ratingKeys);
      if (ratingKeys.length === 0) continue;

      const uri = encodeURIComponent(toPlexUri(machineId, ratingKeys));
      const existing = existingByTitle.get(group.name.trim().toLowerCase());

      try {
        if (existing?.ratingKey) {
          const updateRes = await fetch(
            `${plexBase}/library/collections/${existing.ratingKey}/items?uri=${uri}&X-Plex-Token=${token}`,
            { method: "PUT" },
          );

          if (updateRes.ok) {
            updated++;
          } else {
            plexFailures++;
          }
        } else {
          const createRes = await fetch(
            `${plexBase}/library/collections?type=1&title=${encodeURIComponent(
              group.name,
            )}&sectionId=${sectionId}&smart=0&uri=${uri}&X-Plex-Token=${token}`,
            { method: "POST" },
          );

          if (createRes.ok) {
            created++;
          } else {
            plexFailures++;
          }
        }
      } catch {
        plexFailures++;
      }
    }

    const summary = {
      scannedMovies: movies.length,
      matchedCollections: collectionGroups.size,
      created,
      updated,
      skippedNoTmdb,
      skippedNoCollection,
      tmdbFailures,
      plexFailures,
    };

    await addLog("success", "[collections] Plex collection sync complete", summary);

    return NextResponse.json({ success: true, summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await addLog("error", "[collections] Plex collection sync failed", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
