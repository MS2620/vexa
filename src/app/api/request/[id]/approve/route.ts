import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";
import { notifyUsers } from "@/lib/notifications";
import { createDebridClient, DebridFile } from "@/lib/debrid/client";

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

    const req = await db.get("SELECT * FROM requests WHERE id = ?", [id]);
    if (!req) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Idempotent: if already handled, return OK
    if (req.status !== "Pending Approval" || req.approved === 1) {
      return NextResponse.json({ success: true, alreadyHandled: true });
    }

    await db.run(
      `UPDATE requests SET status = 'Processing', approved = 1 WHERE id = ?`,
      [id],
    );

    const settings = await db.get(
      `SELECT debrid_provider,
              rd_token,
              torbox_api_key,
              plex_url,
              plex_token,
              plex_lib_id,
              plex_tv_lib_id,
              jellyfin_url,
              jellyfin_token,
              tmdb_key
       FROM settings WHERE id = 1`,
    );

    let client;
    try {
      client = createDebridClient({
        provider: settings?.debrid_provider || "realdebrid",
        rd_token: settings?.rd_token || undefined,
        torbox_api_key: settings?.torbox_api_key || undefined,
      });
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Debrid provider not configured" },
        { status: 400 },
      );
    }

    const magnet = `magnet:?xt=urn:btih:${req.info_hash}`;

    // 1. Add magnet to Debrid (TorBox / RD)
    const { id: torrentId } = await client.addMagnet(magnet, req.title || "Unknown");

    // 2. Wait briefly and get info
    await new Promise((resolve) => setTimeout(resolve, 2000));
    let info = await client.getTorrentInfo(torrentId);

    if (!info.files || info.files.length === 0) {
      return NextResponse.json(
        {
          error:
            "No files found in torrent. It may still be fetching metadata.",
        },
        { status: 400 },
      );
    }

    // 3. Select video files (if provider supports it)
    const files = info.files as DebridFile[];

    const videoFiles = files.filter((f) => {
      const isVideo = f.path.match(/\.(mkv|mp4|avi)$/i);
      const isNotSample = !f.path.toLowerCase().includes("sample");
      const isLargeEnough = f.bytes > 30 * 1024 * 1024;
      return isVideo && isNotSample && isLargeEnough;
    });

    const fileIds =
      videoFiles.length > 0
        ? videoFiles.map((f) => f.id)
        : [files.sort((a, b) => b.bytes - a.bytes)[0].id];

    await client.selectFiles(torrentId, fileIds);

    // Optional re-poll (mostly useful for RD; TorBox is no-op)
    try {
      info = await client.getTorrentInfo(torrentId);
    } catch {
      // ignore
    }

    // Map DebridTorrentInfo into the shape createSymlinks expects
    const infoData: { filename: string; files: DebridFile[] } = {
      filename: req.title || "Unknown",
      files: info.files as DebridFile[],
    };

    const { plex: plexPaths, jellyfin: jellyfinPaths } = await createSymlinks({
      infoData,
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

    // Plex library scan
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

    // Jellyfin library scan
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

    // Update status based on scan results + Plex verification
    const anyScanSuccess = plexSuccess || jellyfinSuccess;

    if (anyScanSuccess) {
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
      `UPDATE requests SET status = 'Denied' WHERE id = ?
       AND status = 'Pending Approval' AND approved = 0`,
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