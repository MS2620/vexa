import { NextResponse } from "next/server";
import { initDb, openDb } from "@/lib/db";
import { getSession } from "@/lib/session";

type NotificationRow = {
  id: number;
  type: "automation" | "request" | "system";
  title: string;
  body: string | null;
  target_path: string | null;
  created_at: string;
  is_read: number;
};

type PendingRow = {
  id: number;
  title: string;
  requested_by: string | null;
  requested_at: string;
};

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !session.username) {
      return NextResponse.json(
        { results: [], unreadCount: 0 },
        { status: 401 },
      );
    }

    await initDb();
    const db = await openDb();

    const notifications = await db.all<NotificationRow[]>(
      `SELECT id, type, title, body, target_path, created_at, COALESCE(is_read, 0) AS is_read
       FROM notifications
       WHERE username = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [session.username],
    );

    const unreadRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE username = ? AND COALESCE(is_read, 0) = 0`,
      [session.username],
    );

    const pendingRequests = await db.all<PendingRow[]>(
      `SELECT id, title, requested_by, requested_at
       FROM requests
       WHERE status = 'Pending Approval'
       ORDER BY requested_at DESC
       LIMIT 20`,
    );

    const pendingAsNotifications = pendingRequests.map((row) => ({
      id: `pending-${row.id}`,
      type: "request" as const,
      title: row.title,
      subtitle: row.requested_by
        ? `Requested by ${row.requested_by}`
        : "Pending approval",
      target_path: "/requests",
      created_at: row.requested_at,
      is_read: true,
    }));

    const stored = notifications.map((row) => ({
      id: `notif-${row.id}`,
      type: row.type || "system",
      title: row.title,
      subtitle: row.body,
      target_path: row.target_path || "/",
      created_at: row.created_at,
      is_read: row.is_read === 1,
    }));

    const results = [...stored, ...pendingAsNotifications]
      .sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);

    return NextResponse.json({
      results,
      unreadCount: unreadRow?.count || 0,
    });
  } catch {
    return NextResponse.json({ results: [], unreadCount: 0 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn || !session.username) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const rawId = String(body?.id || "").trim();
    if (!rawId.startsWith("notif-")) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    const notificationId = Number(rawId.replace("notif-", ""));
    if (!Number.isFinite(notificationId) || notificationId <= 0) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    await initDb();
    const db = await openDb();

    const result = await db.run(
      `UPDATE notifications
       SET is_read = 1,
           read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND username = ? AND COALESCE(is_read, 0) = 0`,
      [notificationId, session.username],
    );

    return NextResponse.json({ success: true, updated: result?.changes || 0 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
