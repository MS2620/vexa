import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await openDb();
    const logs = await db.all(
      "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 500",
    );

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("API error fetching logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await openDb();
    await db.run("DELETE FROM logs");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API error clearing logs:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
