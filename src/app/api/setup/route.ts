import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const body = await req.json();
  const db = await openDb();
  
  // 1. Save Settings
  await db.run(`
    UPDATE settings SET 
      tmdb_key = ?, rd_token = ?, plex_url = ?, plex_token = ?, plex_lib_id = ?, plex_tv_lib_id = ?
    WHERE id = 1
  `, [body.tmdb_key, body.rd_token, body.plex_url, body.plex_token, body.plex_lib_id, body.plex_tv_lib_id]);

  // 2. Hash Password and Create Admin User
  const hashedPassword = bcrypt.hashSync(body.password, 10);
  
  await db.run(`
    INSERT INTO users (username, password, role) 
    VALUES (?, ?, 'admin')
  `, [body.username, hashedPassword]);
  
  return NextResponse.json({ success: true });
}
