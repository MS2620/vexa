import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || "1";
    const requestedSortBy = searchParams.get("sort_by") || "popularity.desc";
    const requestedMinVote = searchParams.get("min_vote") || "0";
    const requestedGenre = searchParams.get("genre") || "";
    const requestedYear = searchParams.get("year") || "";

    const allowedSortOptions = [
      "popularity.desc",
      "vote_average.desc",
      "first_air_date.desc",
    ];

    const sortBy = allowedSortOptions.includes(requestedSortBy)
      ? requestedSortBy
      : "popularity.desc";

    const minVoteParsed = Number(requestedMinVote);
    const minVote =
      Number.isFinite(minVoteParsed) &&
      minVoteParsed >= 0 &&
      minVoteParsed <= 10
        ? String(minVoteParsed)
        : "0";

    const allowedGenres = ["10759", "35", "80", "18", "9648", "10765"];
    const genre = allowedGenres.includes(requestedGenre) ? requestedGenre : "";

    const currentYear = new Date().getFullYear();
    const yearParsed = Number(requestedYear);
    const year =
      Number.isInteger(yearParsed) &&
      yearParsed >= 1900 &&
      yearParsed <= currentYear
        ? String(yearParsed)
        : "";

    const db = await openDb();
    const settings = await db.get("SELECT tmdb_key FROM settings WHERE id = 1");

    if (!settings?.tmdb_key) {
      return NextResponse.json({ error: "No TMDB Key" }, { status: 400 });
    }

    const tmdbParams = new URLSearchParams({
      api_key: settings.tmdb_key,
      language: "en-US",
      page,
      sort_by: sortBy,
      include_adult: "false",
      "vote_average.gte": minVote,
    });

    if (genre) tmdbParams.set("with_genres", genre);
    if (year) tmdbParams.set("first_air_date_year", year);

    const res = await fetch(
      `https://api.themoviedb.org/3/discover/tv?${tmdbParams.toString()}`,
    );
    const data = await res.json();

    // Ensure we tag them as tv shows for the UI
    const results = (data.results || []).map((m: any) => ({
      ...m,
      media_type: "tv",
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
