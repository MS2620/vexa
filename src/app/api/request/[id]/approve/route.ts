import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import { createSymlinks } from "@/lib/symlinks";
import { notifyUsers } from "@/lib/notifications";

type RDFile = {
  id: number;
  path: string;
  bytes: number;
};

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params; // Next.js 15: params must be awaited
    const session = await getSession();
    if (session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = await openDb();
    const req = await db.get("SELECT * FROM requests WHERE id = ?", [id]);
    if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settings = await db.get(
      "SELECT rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, tmdb_key FROM settings WHERE id = 1",
    );

    const rdParams = new URLSearchParams();
    rdParams.append("magnet", `magnet:?xt=urn:btih:${req.info_hash}`);
    const rdRes = await fetch(
      "https://api.real-debrid.com/rest/1.0/torrents/addMagnet",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${settings.rd_token}` },
        body: rdParams,
      },
    );
    const rdData = await rdRes.json();

    if (rdData.error) {
      return NextResponse.json(
        { error: `RD: ${rdData.error}` },
        { status: 400 },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const infoRes = await fetch(
      `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
      { headers: { Authorization: `Bearer ${settings.rd_token}` } },
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
      await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${rdData.id}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${settings.rd_token}` },
          body: fileParams,
        },
      );
    }

    // Create Plex symlinks (fire-and-forget)
    createSymlinks({
      infoData,
      title: req.title || "Unknown",
      tmdbId: req.tmdb_id || null,
      mediaType: req.media_type || "movie",
      season: req.season || null,
      tmdbKey: settings.tmdb_key || "",
    }).catch((e) => console.error("[symlinks] Error:", e));

    await db.run(
      `UPDATE requests SET status = 'Requested', approved = 1 WHERE id = ?`,
      [id],
    );

    setTimeout(async () => {
      const mediaType = req.media_type === "tv" ? "tv" : "movie";
      const sectionId =
        mediaType === "tv" ? settings.plex_tv_lib_id : settings.plex_lib_id;

      if (!settings.plex_url || !settings.plex_token || !sectionId) {
        return;
      }

      try {
        const refreshRes = await fetch(
          `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
        );

        if (refreshRes.ok) {
          await notifyUsers({
            type: "request",
            title: `${req.title} added to library`,
            body: `${mediaType === "tv" ? "Series" : "Movie"} request was approved and Plex refresh was triggered.`,
            targetPath: req.tmdb_id
              ? `/media/${mediaType}/${req.tmdb_id}`
              : "/requests",
          });
        }
      } catch (e) {
        console.error("Plex refresh failed:", e);
      }
    }, 5000);

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
    if (session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = await openDb();
    await db.run(`UPDATE requests SET status = 'Denied' WHERE id = ?`, [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
