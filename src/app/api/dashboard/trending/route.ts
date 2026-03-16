import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET() {
  try {
    const db = await openDb();
    const settings = await db.get('SELECT tmdb_key FROM settings WHERE id = 1');
    if (!settings?.tmdb_key) return NextResponse.json({ results: [] });

    const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${settings.tmdb_key}`);
    const data = await res.json();
    return NextResponse.json({ results: data.results || [] });
  } catch (error: any) {
    return NextResponse.json({ results: [] });
  }
}
