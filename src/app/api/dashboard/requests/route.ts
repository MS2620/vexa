import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const db = await openDb();
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");

    if (statusFilter === "pending") {
      const pendingReqs = await db.all(`
        SELECT id, tmdb_id, media_type, title, requested_by, requested_at
        FROM requests 
        WHERE status = 'Pending Approval' 
        ORDER BY requested_at DESC
        LIMIT 100
      `);

      const automationLogs = await db.all(`
        SELECT id, message, context, timestamp
        FROM logs
        WHERE message LIKE '[automation] Added %'
        ORDER BY timestamp DESC
        LIMIT 100
      `);

      const requestNotifications = (pendingReqs || []).map((row: any) => ({
        id: `request-${row.id}`,
        type: "request",
        title: row.title,
        subtitle: `Requested by ${row.requested_by || "Unknown"}`,
        created_at: row.requested_at,
        target_path:
          row.tmdb_id && row.media_type
            ? `/media/${row.media_type}/${row.tmdb_id}`
            : "/requests",
      }));

      const automationNotifications = (automationLogs || [])
        .map((row: any) => ({
          ...(function () {
            try {
              const parsed = row.context ? JSON.parse(row.context) : null;
              return {
                tmdbId: parsed?.tmdbId,
                season: parsed?.season,
                episode: parsed?.episode,
              };
            } catch {
              return {
                tmdbId: null,
                season: null,
                episode: null,
              };
            }
          })(),
          id: `automation-${row.id}`,
          type: "automation",
          title:
            row.message?.replace(/^\[automation\]\s*/i, "") ||
            "Automation update",
          subtitle: "Auto-scheduler added a new episode",
          created_at: row.timestamp,
        }))
        .map((row: any) => ({
          id: row.id,
          type: row.type,
          title: row.title,
          subtitle: row.subtitle,
          created_at: row.created_at,
          target_path: row.tmdbId ? `/media/tv/${row.tmdbId}` : "/requests",
        }));

      const results = [...requestNotifications, ...automationNotifications]
        .sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime;
        })
        .slice(0, 50);

      return NextResponse.json({ results });
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
