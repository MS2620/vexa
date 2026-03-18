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

type CollectionSyncEvent =
  | { type: "phase"; message: string }
  | { type: "total"; count: number }
  | { type: "progress"; current: number; total: number }
  | {
      type: "item";
      status: "created" | "updated" | "skipped" | "failed";
      title: string;
      reason?: string;
    }
  | {
      type: "done";
      scannedMovies: number;
      matchedCollections: number;
      created: number;
      updated: number;
      skippedNoTmdb: number;
      skippedNoCollection: number;
      tmdbFailures: number;
      plexFailures: number;
      skipped: number;
      failed: number;
    }
  | { type: "error"; error: string };

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

    if (
      !settings?.plex_url ||
      !settings?.plex_token ||
      !settings?.plex_lib_id
    ) {
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
    const tmdbKey = settings.tmdb_key;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: CollectionSyncEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        };

        try {
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
            send({
              type: "error",
              error: "Could not resolve Plex machine identifier",
            });
            return;
          }

          const movieRes = await fetch(
            `${plexBase}/library/sections/${sectionId}/all?includeGuids=1&X-Plex-Token=${token}`,
            { headers: { Accept: "application/json" } },
          );

          if (!movieRes.ok) {
            send({ type: "error", error: "Failed to load Plex movie library" });
            return;
          }

          const movieData = await movieRes.json();
          const movies = (movieData?.MediaContainer?.Metadata ||
            []) as PlexItem[];
          const collectionGroups = new Map<number, CollectionGroup>();

          let skippedNoTmdb = 0;
          let skippedNoCollection = 0;
          let tmdbFailures = 0;

          send({
            type: "phase",
            message: "Scanning movies for TMDB collections…",
          });
          send({ type: "total", count: movies.length });

          for (let index = 0; index < movies.length; index++) {
            const movie = movies[index];
            const ratingKey = String(movie.ratingKey || "").trim();
            const displayTitle = String(movie.title || `Movie ${index + 1}`);

            if (!ratingKey) {
              skippedNoTmdb++;
              send({
                type: "item",
                status: "skipped",
                title: displayTitle,
                reason: "Missing Plex rating key",
              });
              send({
                type: "progress",
                current: index + 1,
                total: movies.length,
              });
              continue;
            }

            const tmdbId = getTmdbIdFromPlexGuids(movie.Guid);
            if (!tmdbId) {
              skippedNoTmdb++;
              send({
                type: "item",
                status: "skipped",
                title: displayTitle,
                reason: "No TMDB GUID in Plex metadata",
              });
              send({
                type: "progress",
                current: index + 1,
                total: movies.length,
              });
              continue;
            }

            try {
              const tmdbRes = await fetch(
                `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`,
              );

              if (!tmdbRes.ok) {
                tmdbFailures++;
                send({
                  type: "item",
                  status: "failed",
                  title: displayTitle,
                  reason: `TMDB lookup failed (${tmdbRes.status})`,
                });
                send({
                  type: "progress",
                  current: index + 1,
                  total: movies.length,
                });
                continue;
              }

              const tmdbMovie = await tmdbRes.json();
              const belongs = tmdbMovie?.belongs_to_collection as
                | { id?: number; name?: string }
                | null
                | undefined;

              if (!belongs?.id || !belongs?.name) {
                skippedNoCollection++;
                send({
                  type: "item",
                  status: "skipped",
                  title: displayTitle,
                  reason: "Movie is not part of a TMDB collection",
                });
                send({
                  type: "progress",
                  current: index + 1,
                  total: movies.length,
                });
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
              send({
                type: "item",
                status: "failed",
                title: displayTitle,
                reason: "TMDB lookup failed",
              });
            }

            send({
              type: "progress",
              current: index + 1,
              total: movies.length,
            });
          }

          send({ type: "phase", message: "Applying collections in Plex…" });
          send({ type: "total", count: collectionGroups.size });

          const collectionRes = await fetch(
            `${plexBase}/library/sections/${sectionId}/collections?X-Plex-Token=${token}`,
            { headers: { Accept: "application/json" } },
          );

          const existingCollections = collectionRes.ok
            ? (await collectionRes.json())?.MediaContainer?.Metadata || []
            : [];

          const existingByTitle = new Map<
            string,
            { ratingKey?: string | number; title?: string }
          >();

          for (const collection of existingCollections) {
            const title = String(collection?.title || "")
              .trim()
              .toLowerCase();
            if (!title) continue;
            existingByTitle.set(title, collection);
          }

          let created = 0;
          let updated = 0;
          let plexFailures = 0;

          const groups = Array.from(collectionGroups.values());
          for (let index = 0; index < groups.length; index++) {
            const group = groups[index];
            const ratingKeys = Array.from(group.ratingKeys);
            if (ratingKeys.length === 0) {
              send({
                type: "item",
                status: "skipped",
                title: group.name,
                reason: "No rating keys to apply",
              });
              send({
                type: "progress",
                current: index + 1,
                total: groups.length,
              });
              continue;
            }

            const uri = encodeURIComponent(toPlexUri(machineId, ratingKeys));
            const existing = existingByTitle.get(
              group.name.trim().toLowerCase(),
            );

            try {
              if (existing?.ratingKey) {
                const updateRes = await fetch(
                  `${plexBase}/library/collections/${existing.ratingKey}/items?uri=${uri}&X-Plex-Token=${token}`,
                  { method: "PUT" },
                );

                if (updateRes.ok) {
                  updated++;
                  send({
                    type: "item",
                    status: "updated",
                    title: group.name,
                    reason: `${ratingKeys.length} items`,
                  });
                } else {
                  plexFailures++;
                  send({
                    type: "item",
                    status: "failed",
                    title: group.name,
                    reason: `Plex update failed (${updateRes.status})`,
                  });
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
                  send({
                    type: "item",
                    status: "created",
                    title: group.name,
                    reason: `${ratingKeys.length} items`,
                  });
                } else {
                  plexFailures++;
                  send({
                    type: "item",
                    status: "failed",
                    title: group.name,
                    reason: `Plex create failed (${createRes.status})`,
                  });
                }
              }
            } catch {
              plexFailures++;
              send({
                type: "item",
                status: "failed",
                title: group.name,
                reason: "Plex request failed",
              });
            }

            send({
              type: "progress",
              current: index + 1,
              total: groups.length,
            });
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
            skipped: skippedNoTmdb + skippedNoCollection,
            failed: tmdbFailures + plexFailures,
          };

          await addLog(
            "success",
            "[collections] Plex collection sync complete",
            summary,
          );

          send({ type: "done", ...summary });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          await addLog("error", "[collections] Plex collection sync failed", {
            error: message,
          });
          send({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await addLog("error", "[collections] Plex collection sync failed", {
      error: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
