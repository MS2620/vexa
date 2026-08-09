import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";
import { addLog } from "@/lib/logger";
import { notifyUsers } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const { infoHash, tmdbId, title, posterPath, mediaType, season, episode } =
      await req.json();
    const requestedMediaType = mediaType === "tv" ? "tv" : "movie";

    // Guard: make sure we actually have an infoHash
    if (!infoHash) {
      return NextResponse.json(
        { success: false, error: "No infoHash provided" },
        { status: 400 },
      );
    }

    const db = await openDb();
    const settings = await db.get(
      "SELECT rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, jellyfin_url, jellyfin_token, tmdb_key FROM settings WHERE id = 1",
    );

    if (!settings?.rd_token) {
      return NextResponse.json(
        { success: false, error: "Real-Debrid token not configured" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const requestedBy = session.username || "unknown";
    const currentUser = session.username
      ? await db.get<{ role?: string }>(
          "SELECT role FROM users WHERE username = ? LIMIT 1",
          [session.username],
        )
      : null;
    const isAdmin = (currentUser?.role || session.role) === "admin";

    // ✅ Stop here for non-admins — save to DB and return pending
    if (!isAdmin) {
      await db.run(
        `
        INSERT INTO requests (tmdb_id, title, poster_path, status, requested_by, media_type, season, episode, info_hash, approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          tmdbId || null,
          title || "Unknown",
          posterPath || null,
          "Pending Approval",
          requestedBy,
          requestedMediaType,
          season || null,
          episode || null,
          infoHash,
          0,
        ],
      );

      await addLog("info", `${requestedBy} requested ${title}`, {
        tmdbId,
        mediaType,
        status: "Pending Approval",
      });

      try {
        const admins = await db.all<{ username: string }[]>(
          "SELECT username FROM users WHERE role = 'admin' AND username IS NOT NULL AND TRIM(username) != ''",
        );
        const adminUsernames = admins
          .map((row) => row.username.trim())
          .filter(Boolean);

        if (adminUsernames.length > 0) {
          await notifyUsers({
            type: "request",
            title: "New request pending approval",
            body: `${requestedBy} requested ${title || "a title"}`,
            targetPath: "/requests",
            usernames: adminUsernames,
          });
        }
      } catch (notificationError) {
        await addLog("warn", "Failed to notify admins about pending request", {
          requestedBy,
          title,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }

      return NextResponse.json({ success: true, pending: true });
    }

    // 1. Add Magnet to Real-Debrid
    await addLog("info", `Starting process for ${title}`, {
      infoHash,
      requestedBy,
    });
    const magnet = `magnet:?xt=urn:btih:${infoHash}`;
    const params = new URLSearchParams();
    params.append("magnet", magnet);

    const rdRes = await fetch(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.rd_token}` },
        body: params,
      },
    );

    const rdData = await rdRes.json();

    if (rdData.error) {
      await addLog("warn", `Real-Debrid rejected ${title}`, {
        error: rdData.error,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Real-Debrid: ${rdData.error}`,
          code: rdData.error,
        },
        { status: 400 },
      );
    }

    if (!rdData.id) {
      await addLog("error", `Real-Debrid returned no torrent ID for ${title}`, {
        response: rdData,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Real-Debrid returned no torrent ID. Response: ${JSON.stringify(rdData)}`,
        },
        { status: 400 },
      );
    }

    // 2. Wait for RD to process the magnet, then fetch torrent info
    await addLog(
      "info",
      `Waiting for Real-Debrid to process magnet for ${title}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const infoRes = await fetch(
      `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
      { headers: { Authorization: `Bearer ${settings.rd_token}` } },
    );
    const infoData = await infoRes.json();

    if (!infoData.files || infoData.files.length === 0) {
      await addLog(
        "warn",
        `No files found in torrent for ${title}, waiting for metadata...`,
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "No files found in torrent. It may still be downloading metadata.",
        },
        { status: 400 },
      );
    }

    // 3. Select all valid video files
    const videoFiles = infoData.files.filter((f: any) => {
      const isVideo = f.path.match(/\.(mkv|mp4|avi)$/i);
      const isNotSample = !f.path.toLowerCase().includes("sample");
      const isLargeEnough = f.bytes > 30 * 1024 * 1024; // > 30MB
      return isVideo && isNotSample && isLargeEnough;
    });

    const filesToSelect =
      videoFiles.length > 0
        ? videoFiles.map((f: any) => f.id).join(",")
        : infoData.files
            .sort((a: any, b: any) => b.bytes - a.bytes)[0]
            .id.toString();

    const fileParams = new URLSearchParams();
    fileParams.append("files", filesToSelect);

    await addLog(
      "info",
      `Selecting ${videoFiles.length > 0 ? videoFiles.length : 1} file(s) for ${title} in Real-Debrid`,
    );

    await fetch(
      `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${rdData.id}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.rd_token}` },
        body: fileParams,
      },
    );

    // 4. Re-fetch torrent info after file selection
    let selectedInfoData = infoData;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 750));

      const selectedInfoRes = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
        { headers: { Authorization: `Bearer ${settings.rd_token}` } },
      );
      const latest = await selectedInfoRes.json();

      if (latest?.files?.some((f: any) => f.selected === 1)) {
        selectedInfoData = latest;
        break;
      }

      selectedInfoData = latest;
    }

    // 5. Create symlinks for both Plex and Jellyfin
    createSymlinks({
      infoData: selectedInfoData,
      title: title || "Unknown",
      tmdbId: tmdbId || null,
      mediaType: requestedMediaType,
      season: season || null,
      tmdbKey: settings.tmdb_key || "",
    })
      .then(async ({ plex: plexPaths, jellyfin: jellyfinPaths }) => {
        await addLog(
          "info",
          `Created symlinks for ${title}. Plex: ${plexPaths.length}, Jellyfin: ${jellyfinPaths.length}. Waiting for disk...`,
        );

        // Polling loop to wait for Zurg to expose the files
        const checkPath = plexPaths[0] || jellyfinPaths[0];
        if (checkPath) {
          let fileExists = false;
          let attempts = 0;
          const maxAttempts = 24; // 2 minutes max

          while (!fileExists && attempts < maxAttempts) {
            try {
              await access(checkPath);
              fileExists = true;
            } catch (e) {
              attempts++;
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
          }

          if (fileExists) {
            await addLog("info", `File verified on disk for ${title}.`);
          } else {
            await addLog(
              "warn",
              `Timed out waiting for file locally: ${title}. Generating scan anyway.`,
            );
          }
        }

        // Trigger Plex library scan (if configured)
        if (settings.plex_url && settings.plex_token) {
          const sectionId =
            requestedMediaType === "tv"
              ? settings.plex_tv_lib_id
              : settings.plex_lib_id;

          if (sectionId && isAdmin) {
            await addLog(
              "info",
              `Triggering Plex library scan for ${title} (${requestedMediaType})`,
            );
            const refreshRes = await fetch(
              `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
            ).catch((e) => {
              console.error("Plex refresh failed:", e);
              return null;
            });

            if (refreshRes?.ok) {
              await addLog("info", `Plex scan triggered for ${title}`);
            }
          }
        }

        // Trigger Jellyfin library scan (if configured)
        if (settings.jellyfin_url && settings.jellyfin_token && isAdmin) {
          await addLog(
            "info",
            `Triggering Jellyfin library scan for ${title} (${requestedMediaType})`,
          );

          // Determine library type
          const libraryType = requestedMediaType === "tv" ? "series" : "movie";

          try {
            // Get library ID by name/type
            const librariesRes = await fetch(
              `${settings.jellyfin_url}/Library/VirtualFolders?X-Emby-Token=${settings.jellyfin_token}`,
            );
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
                await addLog("info", `Jellyfin scan triggered for ${title}`);
              }
            }
          } catch (e) {
            console.error("Jellyfin refresh failed:", e);
          }
        }

        // Notify users
        await notifyUsers({
          type: "request",
          title: `${title} added to library`,
          body: `${requestedMediaType === "tv" ? "Series" : "Movie"} request was added and library scans triggered.`,
          targetPath: tmdbId
            ? `/media/${requestedMediaType}/${tmdbId}`
            : "/requests",
        });
      })
      .catch((e) => {
        console.error("[symlinks] Error:", e);
        addLog("error", `Failed to create symlinks for ${title}`, {
          error: e?.message,
        });
      });

    // 6. Save request to SQLite
    await db.run(
      `
      INSERT INTO requests (tmdb_id, title, poster_path, status, requested_by, media_type, season, episode, info_hash, approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        tmdbId || null,
        title || "Unknown",
        posterPath || null,
        "Requested",
        requestedBy,
        requestedMediaType,
        season || null,
        episode || null,
        infoHash,
        1,
      ],
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Request API error:", error);
    await addLog("error", `Exception during request`, {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}