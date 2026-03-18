import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { openDb } from "@/lib/db";

export async function GET() {
  const session = await getSession();

  if (!session.isLoggedIn || !session.username) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await openDb();
  const user = await db.get<{ role?: string }>(
    "SELECT role FROM users WHERE username = ? LIMIT 1",
    [session.username],
  );

  const role = user?.role || session.role || "user";

  if (session.role !== role) {
    session.role = role;
    await session.save();
  }

  return NextResponse.json({
    username: session.username,
    role,
  });
}
