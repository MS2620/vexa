import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";

async function getMountHealth() {
  const debridMount = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
  const plexSymlinkRoot = process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";

  const [debridReadable, symlinkWritable] = await Promise.allSettled([
    access(debridMount, fsConstants.R_OK),
    access(plexSymlinkRoot, fsConstants.W_OK),
  ]);

  return {
    debrid_mount: {
      path: debridMount,
      readable: debridReadable.status === "fulfilled",
      error:
        debridReadable.status === "rejected"
          ? String(debridReadable.reason)
          : null,
    },
    plex_symlink_root: {
      path: plexSymlinkRoot,
      writable: symlinkWritable.status === "fulfilled",
      error:
        symlinkWritable.status === "rejected"
          ? String(symlinkWritable.reason)
          : null,
    },
  };
}

export async function GET() {
  try {
    const db = await openDb();
    const mounts = await getMountHealth();
    const settings = await db.get(
      "SELECT rd_token, plex_url, plex_token FROM settings WHERE id = 1",
    );

    const [rdUser, rdTorrents, plexCheck] = await Promise.allSettled([
      fetch("https://api.real-debrid.com/rest/1.0/user", {
        headers: { Authorization: `Bearer ${settings?.rd_token}` },
      }).then((r) => r.json()),

      fetch("https://api.real-debrid.com/rest/1.0/torrents?limit=5", {
        headers: { Authorization: `Bearer ${settings?.rd_token}` },
      }).then((r) => r.json()),

      fetch(
        `${settings?.plex_url}/identity?X-Plex-Token=${settings?.plex_token}`,
      ).then((r) => ({ ok: r.ok })),
    ]);

    return NextResponse.json({
      rd: {
        status:
          rdUser.status === "fulfilled" && !rdUser.value.error
            ? "connected"
            : "error",
        user: rdUser.status === "fulfilled" ? rdUser.value : null,
        torrents: rdTorrents.status === "fulfilled" ? rdTorrents.value : [],
      },
      plex: {
        status:
          plexCheck.status === "fulfilled" && (plexCheck.value as any).ok
            ? "connected"
            : "error",
      },
      mounts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
