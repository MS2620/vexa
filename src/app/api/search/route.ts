import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');
  if (!query) return NextResponse.json({ results: [] });

  const db = await openDb();
  const settings = await db.get('SELECT tmdb_key FROM settings WHERE id = 1');
  if (!settings?.tmdb_key) return NextResponse.json({ error: "No TMDB Key" }, { status: 400 });

  // Use /multi to get both movies and tv shows
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&api_key=${settings.tmdb_key}`);
  const data = await res.json();
  
  // Filter out actors/people, keep only media
  const results = (data.results || []).filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
  
  return NextResponse.json({ results });
}
