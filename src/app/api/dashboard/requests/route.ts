import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const db = await openDb();
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");

    if (statusFilter === "pending") {
      const pendingReqs = await db.all(`
        SELECT * FROM requests 
        WHERE status = 'Pending Approval' 
        ORDER BY requested_at DESC
      `);
      return NextResponse.json({ results: pendingReqs || [] });
    }

    // Group by title, show the most recent request per title
    // and aggregate season numbers into a comma-separated list
    const requests = await db.all(`
      SELECT 
        MIN(id) as id,
        tmdb_id,
        title,
        poster_path,
        media_type,
        requested_by,
        MAX(requested_at) as requested_at,
        GROUP_CONCAT(season ORDER BY season ASC) as seasons,
        -- If ANY season is still Requested, show Requested. Only Available if all are.
        CASE 
          WHEN SUM(CASE WHEN status = 'Requested' THEN 1 ELSE 0 END) > 0 
          THEN 'Requested' 
          ELSE 'Available' 
        END as status
      FROM requests
      GROUP BY title
      ORDER BY MAX(requested_at) DESC
      LIMIT 10
    `);

    // Parse the seasons string back into an array
    const results = requests.map((req: any) => ({
      ...req,
      seasons: req.seasons
        ? req.seasons.split(",").map(Number).filter(Boolean)
        : null,
    }));

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ results: [] });
  }
}
