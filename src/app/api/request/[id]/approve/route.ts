import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";
import { notifyUsers } from "@/lib/notifications";

type RDFile = {
  id: number;
  path: string;
  bytes: number;
  selected?: number;
};

let lastRdCall = 0;
const RD_MIN_INTERVAL_MS = 300; // ~3 RD calls/sec max

async function rdFetch(
  url: string,
  init: RequestInit,
  token: string,
): Promise<Response> {
  const now = Date.now();
  const wait = lastRdCall + RD_MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRdCall = Date.now();

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (res.status === 429) {
    console.warn("[rd] 429 too_many_requests — backing off 5s");
    await new Promise((r) => setTimeout(r, 5000));
  }

  return res;
}

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await openDb();

    // Load the request once, and make this route idempotent.
    const req = await db.get(
      "SELECT * FROM requests WHERE id = ?",
      [id],
    );

    if (!req) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // If already not pending, just say "ok" and exit — prevents double processing.
    if (req.status !== "Pending Approval" || req.approved === 1) {
      return NextResponse.json({ success: true, alreadyHandled: true });
    }

    // Transition to Processing only once.
    await db.run(
      `UPDATE requests SET status = 'Processing', approved = 1 WHERE id = ?`,
      [id],
    );

    const settings = await db.get(
      "SELECT rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, jellyfin_url, jellyfin_token, tmdb_key FROM settings WHERE id = 1",
    );

    if (!settings?.rd_token) {
      return NextResponse.json(
        { error: "Real-Debrid token not configured" },
        { status: 400 },
      );
    }

    const rdParams = new URLSearchParams();
    rdParams.append("magnet", `magnet:?xt=urn:btih:${req.info_hash}`);

    const rdRes = await rdFetch(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      {
        method: "POST",
        body: rdParams,
      },
      settings.rd_token,
    );
    const rdData = await rdRes.json();

    if (rdData.error) {
      // Do not retry this torrent here; return error to UI.
      return NextResponse.json(
        { error: `RD: ${rdData.error}` },
        { status: 400 },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const infoRes = await rdFetch(
      `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
      { method: "GET" },
      settings.rd_token,
    );
    const infoData = await infoRes.json();

    if (infoData.files?.length > 0) {
      const videoFiles = infoData.files.filter(
        (f: RDFile) =>
          f.path.match(/\.(mkv|mp4|avi)$/i) &&
          !f.path.toLowerCase().includes("sample") &&
          f.bytes > 30 * 1024 * 1024,
      );
      const filesToSelect =
        videoFiles.length > 0
          ? videoFiles.map((f: RDFile) => f.id).join(",")
          : infoData.files
              .sort((a: RDFile, b: RDFile) => b.bytes - a.bytes)[0]
              .id.toString();

      const fileParams = new URLSearchParams();
      fileParams.append("files", filesToSelect);
      await rdFetch(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${rdData.id}`,
        {
          method: "POST",
          body: fileParams,
        },
        settings.rd_token,
      );
    }

    let selectedInfoData = infoData;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 750));

      const selectedInfoRes = await rdFetch(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
        { method: "GET" },
        settings.rd_token,
      );
      const latest = await selectedInfoRes.json();

      if (latest?.files?.some((f: RDFile) => f.selected === 1)) {
        selectedInfoData = latest;
        break;
      }

      selectedInfoData = latest;
    }

    // Create symlinks for both Plex and Jellyfin
    const { plex: plexPaths, jellyfin: jellyfinPaths } = await createSymlinks({
      infoData: selectedInfoData,
      title: req.title || "Unknown",
      tmdbId: req.tmdb_id || null,
      mediaType: (req.media_type as "movie" | "tv") || "movie",
      season: req.season || null,
      tmdbKey: settings.tmdb_key || "",
    });

    // Wait for files to appear on disk
    const checkPath = plexPaths[0] || jellyfinPaths[0];
    if (checkPath) {
      let fileExists = false;
      let attempts = 0;
      const maxAttempts = 24;

      while (!fileExists && attempts < maxAttempts) {
        try {
          await access(checkPath);
          fileExists = true;
        } catch {
          attempts++;
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    }

    const mediaType = req.media_type === "tv" ? "tv" : "movie";
    let plexSuccess = false;
    let jellyfinSuccess = false;

    // Trigger Plex library scan
    if (settings.plex_url && settings.plex_token) {
      try {
        const sectionId =
          mediaType === "tv" ? settings.plex_tv_lib_id : settings.plex_lib_id;

        const refreshRes = sectionId
          ? await fetch(
              `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
            )
          : await fetch(
              `${settings.plex_url}/library/sections/all/refresh?X-Plex-Token=${settings.plex_token}`,
            );

        if (refreshRes.ok) {
          plexSuccess = true;
          console.log(`[approve] Plex scan triggered for ${req.title}`);
        }
      } catch (e) {
        console.error("Plex refresh failed:", e);
      }
    }

    // Trigger Jellyfin library scan
    if (settings.jellyfin_url && settings.jellyfin_token) {
      try {
        const libraryType = mediaType === "tv" ? "series" : "movie";

        const librariesRes = await fetch(
          `${settings.jellyfin_url}/Library/VirtualFolders?X-Emby-Token=${settings.jellyfin_token}`,
        );

        if (librariesRes.ok) {
          const libraries = await librariesRes.json();
          const targetLibrary = libraries.find(
            (lib: any) =>
              lib.LibraryOptions?.ContentType === libraryType ||
              lib.Name.toLowerCase().includes(libraryType),
          );

          if (targetLibrary?.Name) {
            const scanRes = await fetch(
              `${settings.jellyfin_url}/Library/Refresh?X-Emby-Token=${settings.jellyfin_token}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  LibraryOptions: {
                    Name: targetLibrary.Name,
                  },
                }),
              },
            );

            if (scanRes.ok) {
              jellyfinSuccess = true;
              console.log(`[approve] Jellyfin scan triggered for ${req.title}`);
            }
          }
        }
      } catch (e) {
        console.error("Jellyfin refresh failed:", e);
      }
    }

    // Notify users
    await notifyUsers({
      type: "request",
      title: `${req.title} added to library`,
      body: `${
        mediaType === "tv" ? "Series" : "Movie"
      } request was approved and library scans triggered.`,
      targetPath: req.tmdb_id
        ? `/media/${mediaType}/${req.tmdb_id}`
        : "/requests",
    });

    // Update status based on scan results
    const anyScanSuccess = plexSuccess || jellyfinSuccess;

    if (anyScanSuccess) {
      // Try to verify availability in Plex (if Plex scan ran)
      if (plexSuccess && settings.plex_url && settings.plex_token) {
        try {
          const sectionId =
            mediaType === "tv" ? settings.plex_tv_lib_id : settings.plex_lib_id;

          if (sectionId) {
            const plexItemsRes = await fetch(
              `${settings.plex_url}/library/sections/${sectionId}/all?includeGuids=1&X-Plex-Token=${settings.plex_token}`,
              { headers: { Accept: "application/json" } },
            );

            if (plexItemsRes.ok) {
              const plexData = await plexItemsRes.json();
              const metadata = plexData?.MediaContainer?.Metadata || [];
              const tmdbId = req.tmdb_id?.toString();
              const titleNorm = req.title?.toLowerCase().trim();

              const found = metadata.some((item: any) => {
                const tmdbGuids = (item.Guid || [])
                  .filter((guid: any) => guid.id?.startsWith("tmdb://"))
                  .map((guid: any) => guid.id.replace("tmdb://", ""));
                const plexTitle = item.title?.toLowerCase().trim();

                return (
                  (tmdbId && tmdbGuids.includes(tmdbId)) ||
                  (titleNorm && plexTitle === titleNorm)
                );
              });

              await db.run(
                `UPDATE requests SET status = ? WHERE id = ?`,
                [found ? "Available" : "Requested", id],
              );
            } else {
              await db.run(
                `UPDATE requests SET status = 'Requested' WHERE id = ?`,
                [id],
              );
            }
          } else {
            await db.run(
              `UPDATE requests SET status = 'Requested' WHERE id = ?`,
              [id],
            );
          }
        } catch (e) {
          console.error("Plex verification failed:", e);
          await db.run(
            `UPDATE requests SET status = 'Requested' WHERE id = ?`,
            [id],
          );
        }
      } else {
        await db.run(
          `UPDATE requests SET status = 'Requested' WHERE id = ?`,
          [id],
        );
      }
    } else {
      await db.run(
        `UPDATE requests SET status = 'Requested' WHERE id = ?`,
        [id],
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Approve error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await openDb();
    const result = await db.run(
      `UPDATE requests SET status = 'Denied' WHERE id = ? AND status = 'Pending Approval' AND approved = 0`,
      [id],
    );

    if (!result.changes) {
      return NextResponse.json(
        { error: "Request is no longer pending approval" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}