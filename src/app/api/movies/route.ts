import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get('page') || '1';

    const db = await openDb();
    const settings = await db.get('SELECT tmdb_key FROM settings WHERE id = 1');
    
    if (!settings?.tmdb_key) {
      return NextResponse.json({ error: "No TMDB Key" }, { status: 400 });
    }

    // Fetch popular movies
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${settings.tmdb_key}&language=en-US&page=${page}`
    );
    const data = await res.json();
    
    // Ensure we tag them as movies for the UI
    const results = (data.results || []).map((m: any) => ({ ...m, media_type: 'movie' }));
    
    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
