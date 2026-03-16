import { NextResponse } from 'next/server';
import { openDb, initDb } from '@/lib/db';

export async function GET() {
  await initDb();
  const db = await openDb();
  const settings = await db.get('SELECT tmdb_key, rd_token, plex_url, plex_token, plex_lib_id, plex_tv_lib_id FROM settings WHERE id = 1');
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  const body = await req.json();
  const db = await openDb();
  
  await db.run(`
    UPDATE settings SET 
      tmdb_key = ?, rd_token = ?, plex_url = ?, plex_token = ?, plex_lib_id = ?, plex_tv_lib_id = ?
    WHERE id = 1
  `, [body.tmdb_key, body.rd_token, body.plex_url, body.plex_token, body.plex_lib_id, body.plex_tv_lib_id]);
  
  return NextResponse.json({ success: true });
}
