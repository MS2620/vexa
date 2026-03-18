import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { initDb, openDb } from "@/lib/db";
import { ensureVapidKeys } from "@/lib/push-config";

export async function GET() {
  const session = await getSession();
  if (!session?.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await initDb();
    const db = await openDb();
    const keys = await ensureVapidKeys(db);

    return NextResponse.json({ publicKey: keys.publicKey });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load VAPID public key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
