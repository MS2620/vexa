import { NextResponse } from 'next/server';
import { openDb, initDb } from '@/lib/db';

export async function GET() {
  try {
    // 1. Initialize the DB (Creates tables if they don't exist)
    await initDb();
    
    // 2. Open and check settings
    const db = await openDb();
    const settings = await db.get('SELECT tmdb_key FROM settings WHERE id = 1');
    
    return NextResponse.json({ isConfigured: !!settings?.tmdb_key });
  } catch (error: any) {
    console.error("DB Setup Error:", error);
    return NextResponse.json({ isConfigured: false });
  }
}
