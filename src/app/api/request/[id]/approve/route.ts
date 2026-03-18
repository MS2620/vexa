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
    const req = await db.get(
      "SELECT * FROM requests WHERE id = ? AND status = 'Pending Approval' AND approved = 0",
      [id],
    );
    if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.run(
      `UPDATE requests SET status = 'Processing', approved = 1 WHERE id = ?`,
      [id],
    );

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

    let selectedInfoData = infoData;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 750));

      const selectedInfoRes = await fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${rdData.id}`,
        { headers: { Authorization: `Bearer ${settings.rd_token}` } },
      );
      const latest = await selectedInfoRes.json();

      if (latest?.files?.some((f: RDFile) => f.selected === 1)) {
        selectedInfoData = latest;
        break;
      }

      selectedInfoData = latest;
    }

    const createdPaths = await createSymlinks({
      infoData: selectedInfoData,
      title: req.title || "Unknown",
      tmdbId: req.tmdb_id || null,
      mediaType: req.media_type || "movie",
      season: req.season || null,
      tmdbKey: settings.tmdb_key || "",
    });

    if (createdPaths.length > 0) {
      const checkPath = createdPaths[0];
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
    const sectionId =
      mediaType === "tv" ? settings.plex_tv_lib_id : settings.plex_lib_id;

    if (settings.plex_url && settings.plex_token) {
      try {
        const refreshRes = sectionId
          ? await fetch(
              `${settings.plex_url}/library/sections/${sectionId}/refresh?X-Plex-Token=${settings.plex_token}`,
            )
          : await fetch(
              `${settings.plex_url}/library/sections/all/refresh?X-Plex-Token=${settings.plex_token}`,
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

          if (!sectionId) {
            await db.run(
              `UPDATE requests SET status = 'Requested' WHERE id = ?`,
              [id],
            );
          } else {
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

              if (found) {
                await db.run(
                  `UPDATE requests SET status = 'Available' WHERE id = ?`,
                  [id],
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
          }
        }
      } catch (e) {
        console.error("Plex refresh failed:", e);
        await db.run(`UPDATE requests SET status = 'Requested' WHERE id = ?`, [
          id,
        ]);
      }
    } else {
      await db.run(`UPDATE requests SET status = 'Requested' WHERE id = ?`, [
        id,
      ]);
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
    if (session.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
