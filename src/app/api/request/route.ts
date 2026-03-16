import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";

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

      return NextResponse.json({ success: true, pending: true });
    }

    // 1. Add Magnet to Real-Debrid
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
      return NextResponse.json(
        {
          success: false,
          error: `Real-Debrid returned no torrent ID. Response: ${JSON.stringify(rdData)}`,
        },
        { status: 400 },
      );
    }

    // 2. Wait briefly for RD to process the magnet, then fetch torrent info
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const infoRes = await fetch(
      `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
      { headers: { Authorization: `Bearer ${settings.rd_token}` } },
    );
    const infoData = await infoRes.json();

    console.log("RD torrent info status:", infoData.status);

    if (!infoData.files || infoData.files.length === 0) {
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
    }).catch((e) => console.error("[symlinks] Error:", e));

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

    // 7. Trigger Plex scan after a delay
    setTimeout(() => {
      const sectionId =
        requestedMediaType === "tv"
          ? settings.plex_tv_lib_id
          : settings.plex_lib_id;

      if (!settings.plex_url || !settings.plex_token || !sectionId) {
        return;
      }

      fetch(
        `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
      ).catch((e) => console.error("Plex refresh failed:", e));
    }, 5000);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Request API error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
