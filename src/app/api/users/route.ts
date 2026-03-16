import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

// GET all users (admin only)
export async function GET() {
  const session = await getSession();
  if (session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await openDb();
  const users = await db.all(
    "SELECT id, username, role, notify_email FROM users ORDER BY id ASC",
  );
  return NextResponse.json({ users });
}

// POST create new user (admin only)
export async function POST(req: Request) {
  const session = await getSession();
  if (session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { username, password, role, notify_email } = await req.json();
  if (!username || !password)
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 },
    );

  const db = await openDb();
  const hashed = bcrypt.hashSync(password, 10);

  try {
    await db.run(
      "INSERT INTO users (username, password, role, notify_email) VALUES (?, ?, ?, ?)",
      [username, hashed, role || "user", notify_email || ""],
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message.includes("UNIQUE constraint failed")) {
        return NextResponse.json(
          { error: "Username already exists" },
          { status: 409 },
        );
      }
    }
    return NextResponse.json(
      { error: "An error occurred while creating the user" },
      { status: 500 },
    );
  }
}
