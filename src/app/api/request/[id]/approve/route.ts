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

  // Idempotent guard
  if (req.status !== "Pending Approval" || req.approved === 1) {
    return NextResponse.json({ success: true, alreadyHandled: true });
  }

  // Mark as Processing
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
    await db.run(
      `UPDATE requests SET status = 'Pending Approval', approved = 0 WHERE id = ?`,
      [id],
    );
    return NextResponse.json(
      { error: e?.message || "Debrid provider not configured" },
      { status: 400 },
    );
  }

  try {
    const magnet = `magnet:?xt=urn:btih:${req.info_hash}`;

    // 1. Add magnet to Debrid
    const { id: torrentId } = await client.addMagnet(
      magnet,
      req.title || "Unknown",
    );

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

    // 3. Select video files
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

    try {
      await client.selectFiles(torrentId, fileIds);
    } catch {
      // ignore
    }

    try {
      info = await client.getTorrentInfo(torrentId);
    } catch {
      // ignore
    }

    const infoData: { filename: string; files: DebridFile[] } = {
      filename: info.filename || req.title || "Unknown",
      files: (info.files as DebridFile[]) || [],
    };

    // 4. Create symlinks
    const { plex: plexPaths, jellyfin: jellyfinPaths } = await createSymlinks({
      infoData,
      title: req.title || "Unknown",
      tmdbId: req.tmdb_id || null,
      mediaType: (req.media_type as "movie" | "tv") || "movie",
      season: req.season || null,
      episode: req.episode || null,
      tmdbKey: settings?.tmdb_key || "",
      provider: settings?.debrid_provider || "realdebrid",
    });

    // 5. Wait for files to appear on disk
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

    // 6. Trigger Plex scan
    if (settings?.plex_url && settings?.plex_token) {
      try {
        const sectionId =
          mediaType === "tv" ? settings.plex_tv_lib_id : settings.plex_lib_id;

        if (sectionId) {
          await fetch(
            `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
          );
        }
      } catch (e) {
        console.error("Plex refresh failed:", e);
      }
    }

    // 7. Trigger Jellyfin scan
    if (settings?.jellyfin_url && settings?.jellyfin_token) {
      try {
        const targetCollectionType = mediaType === "tv" ? "tvshows" : "movies";

        const librariesRes = await fetch(
          `${settings.jellyfin_url}/Library/VirtualFolders?X-Emby-Token=${settings.jellyfin_token}`,
        );

        if (librariesRes.ok) {
          const libraries = await librariesRes.json();
          const targetLibrary = libraries.find(
            (lib: any) =>
              lib.CollectionType === targetCollectionType ||
              lib.Name.toLowerCase().includes(mediaType),
          );

          if (targetLibrary?.ItemId) {
            await fetch(
              `${settings.jellyfin_url}/Items/${targetLibrary.ItemId}/Refresh?Recursive=true`,
              {
                method: "POST",
                headers: {
                  "X-Emby-Token": settings.jellyfin_token,
                },
              },
            );
          }
        }
      } catch (e) {
        console.error("Jellyfin refresh failed:", e);
      }
    }

    // Update status to Requested once symlinks and scans are complete
    await db.run(`UPDATE requests SET status = 'Requested' WHERE id = ?`, [id]);

    // Notify user who requested
    await notifyUsers({
      type: "request",
      title: `${req.title} approved`,
      body: `Your ${
        mediaType === "tv" ? "Series" : "Movie"
      } request was approved and added to the media server.`,
      targetPath: req.tmdb_id
        ? `/media/${mediaType}/${req.tmdb_id}`
        : "/requests",
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    // Revert status on processing error
    await db.run(
      `UPDATE requests SET status = 'Pending Approval', approved = 0 WHERE id = ?`,
      [id],
    );
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