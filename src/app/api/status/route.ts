import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

export async function GET() {
  try {
    const db = await openDb();
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
