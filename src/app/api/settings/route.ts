import { NextResponse } from "next/server";
import { openDb, initDb } from "@/lib/db";
import { DEFAULT_VAPID_SUBJECT } from "@/lib/push-config";

export async function GET() {
  await initDb();
  const db = await openDb();
  const settings = await db.get<any>(
    "SELECT tmdb_key, rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id, preferred_resolution, preferred_language, vapid_subject FROM settings WHERE id = 1",
  );

  if (!settings?.vapid_subject?.trim()) {
    settings.vapid_subject = DEFAULT_VAPID_SUBJECT;
  }

  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json();
  const db = await openDb();
  const vapidSubject =
    typeof body.vapid_subject === "string" && body.vapid_subject.trim()
      ? body.vapid_subject.trim()
      : DEFAULT_VAPID_SUBJECT;

  await db.run(
    `
    UPDATE settings SET 
      tmdb_key = ?, rd_token = ?, plex_url = ?, plex_token = ?, plex_lib_id = ?, plex_tv_lib_id = ?, preferred_resolution = ?, preferred_language = ?, vapid_subject = ?
    WHERE id = 1
  `,
    [
      body.tmdb_key,
      body.rd_token,
      body.plex_url,
      body.plex_token,
      body.plex_lib_id,
      body.plex_tv_lib_id,
      body.preferred_resolution,
      body.preferred_language,
      vapidSubject,
    ],
  );

  return NextResponse.json({ success: true });
}
