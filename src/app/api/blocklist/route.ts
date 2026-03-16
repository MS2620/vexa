import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const db = await openDb();
  const items = await db.all("SELECT * FROM blocklist ORDER BY added_at DESC");
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { infoHash, title } = await req.json();
  if (!infoHash)
    return NextResponse.json({ error: "infoHash required" }, { status: 400 });

  const session = await getSession();
  const db = await openDb();

  try {
    await db.run(
      "INSERT INTO blocklist (info_hash, title, added_by) VALUES (?, ?, ?)",
      [infoHash, title || "Unknown", session.username || "unknown"],
    );
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Already blocklisted" }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const { infoHash } = await req.json();
  const db = await openDb();
  await db.run("DELETE FROM blocklist WHERE info_hash = ?", [infoHash]);
  return NextResponse.json({ success: true });
}
