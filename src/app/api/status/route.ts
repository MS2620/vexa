import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { access } from "fs/promises";
import { constants as fsConstants } from "fs";

async function getMountHealth() {
  const debridMount = process.env.DEBRID_MOUNT || "/mnt/zurg/__all__";
  const plexSymlinkRoot = process.env.PLEX_SYMLINK_ROOT || "/mnt/plex_symlinks";
  const jellyfinLinkRoot = process.env.JELLYFIN_LINK_ROOT || "/mnt/jellyfin_links";

  const [
    debridReadable,
    plexWritable,
    jellyfinWritable,
    sameFilesystemCheck,
  ] = await Promise.allSettled([
    access(debridMount, fsConstants.R_OK),
    access(plexSymlinkRoot, fsConstants.W_OK),
    access(jellyfinLinkRoot, fsConstants.W_OK),
    Promise.all([
      access(debridMount, fsConstants.F_OK),
      access(jellyfinLinkRoot, fsConstants.F_OK),
    ]).then(async () => {
      try {
        const [debridStat, jellyfinStat] = await Promise.all([
          import("fs/promises").then((fs) => fs.stat(debridMount)),
          import("fs/promises").then((fs) => fs.stat(jellyfinLinkRoot)),
        ]);
        return debridStat.dev === jellyfinStat.dev;
      } catch {
        return null;
      }
    }),
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
      writable: plexWritable.status === "fulfilled",
      error:
        plexWritable.status === "rejected"
          ? String(plexWritable.reason)
          : null,
    },
    jellyfin_link_root: {
      path: jellyfinLinkRoot,
      writable: jellyfinWritable.status === "fulfilled",
      error:
        jellyfinWritable.status === "rejected"
          ? String(jellyfinWritable.reason)
          : null,
    },
    hard_link_capable: sameFilesystemCheck.status === "fulfilled"
      ? sameFilesystemCheck.value
      : null,
  };
}

export async function GET() {
  try {
    const db = await openDb();
    const mounts = await getMountHealth();
    const settings = await db.get(
      "SELECT rd_token, plex_url, plex_token, jellyfin_url, jellyfin_token FROM settings WHERE id = 1",
    );

    const [rdUser, rdTorrents, plexCheck, jellyfinCheck] = await Promise.allSettled([
      fetch("https://api.real-debrid.com/rest/1.0/user", {
        headers: { Authorization: `Bearer ${settings?.rd_token}` },
      }).then((r) => r.json()),

      fetch("https://api.real-debrid.com/rest/1.0/torrents?limit=5", {
        headers: { Authorization: `Bearer ${settings?.rd_token}` },
      }).then((r) => r.json()),

      // Plex API check
      settings?.plex_url && settings?.plex_token
        ? fetch(
            `${settings.plex_url}/identity?X-Plex-Token=${settings.plex_token}`,
          ).then((r) => ({ ok: r.ok }))
        : Promise.resolve({ ok: false }),

      // Jellyfin API check - CORRECT ENDPOINT
      settings?.jellyfin_url && settings?.jellyfin_token
        ? fetch(
            `${settings.jellyfin_url}/System/Info`,
            {
              headers: { 
                "X-Emby-Token": settings.jellyfin_token 
              },
            }
          ).then((r) => ({ ok: r.ok }))
        : Promise.resolve({ ok: false }),
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
            : "disconnected",
        url: settings?.plex_url || null,
      },
      jellyfin: {
        status:
          jellyfinCheck.status === "fulfilled" && (jellyfinCheck.value as any).ok
            ? "connected"
            : "disconnected",
        url: settings?.jellyfin_url || null,
      },
      mounts,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}