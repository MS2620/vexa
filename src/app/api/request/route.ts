import { NextResponse } from "next/server";
import { access } from "fs/promises";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";
import { addLog } from "@/lib/logger";

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
      "SELECT rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, tmdb_key FROM settings WHERE id = 1",
    );

    if (!settings?.rd_token) {
      return NextResponse.json(
        { success: false, error: "Real-Debrid token not configured" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const requestedBy = session.username || "unknown";
    const isAdmin = session.role === "admin";

    // ✅ Stop here for non-admins — save to DB and return pending
    // Don't touch RD at all until an admin approves
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

    // Log the full RD response so you can debug in the terminal
    console.log("RD addMagnet response:", JSON.stringify(rdData));

    // RD returns { error, error_code } on failure
    if (rdData.error) {
      await addLog("warn", `Real-Debrid rejected ${title}`, {
        error: rdData.error,
      });
      // infringing_file means RD has blocked this specific torrent
      // Return a specific code so the UI can automatically try the next stream
      return NextResponse.json(
        {
          success: false,
          error: `Real-Debrid: ${rdData.error}`,
          code: rdData.error, // e.g. "infringing_file", "bad_token", etc.
        },
        { status: 400 },
      );
    }

    // If the torrent is already cached in RD it may return an existing id
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

    // 2. Wait briefly for RD to process the magnet, then fetch torrent info
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

    console.log("RD torrent info status:", infoData.status);

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

    // 3. Select all valid video files (handles both single files and season packs)
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

    // 4. Re-fetch torrent info after file selection so `selected` flags are up to date
    // RD can take a moment to apply selection; retry briefly before symlinking.
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

      // Keep last payload even if selection wasn't reflected yet.
      selectedInfoData = latest;
    }

    // 5. Create Plex symlinks (fire-and-forget — does not block the response)
    createSymlinks({
      infoData: selectedInfoData,
      title: title || "Unknown",
      tmdbId: tmdbId || null,
      mediaType: requestedMediaType,
      season: season || null,
      tmdbKey: settings.tmdb_key || "",
    })
      .then(async (createdPaths) => {
        await addLog(
          "success",
          `Created Plex symlinks for ${title}. Waiting for disk...`,
        );

        // Polling loop to wait for Zurg to expose the first newly created file
        // We only really need to check if the first target exists, as they usually show up together.
        if (createdPaths && createdPaths.length > 0) {
          const checkPath = createdPaths[0];
          let fileExists = false;
          let attempts = 0;
          const maxAttempts = 24; // 2 minutes max (24 * 5 seconds)

          while (!fileExists && attempts < maxAttempts) {
            try {
              // We check the symlink path itself; if it's broken, access should fail.
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

        const sectionId =
          requestedMediaType === "tv"
            ? settings.plex_tv_lib_id
            : settings.plex_lib_id;

        if (settings.plex_url && settings.plex_token && sectionId && isAdmin) {
          await addLog(
            "info",
            `Triggering Plex library scan for ${title} (${requestedMediaType})`,
          );
          await fetch(
            `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
          ).catch((e) => console.error("Plex refresh failed:", e));
        }
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

    // Only send to RD if approved
    if (!isAdmin) {
      return NextResponse.json({ success: true, pending: true });
    }

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
