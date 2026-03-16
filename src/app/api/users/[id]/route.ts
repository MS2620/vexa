import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

// DELETE user
export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await openDb();
  await db.run("DELETE FROM users WHERE id = ?", [id]);
  return NextResponse.json({ success: true });
}

// PATCH update user (role, password, email)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role, password, notify_email } = await req.json();
  const db = await openDb();

  if (password) {
    const hashed = bcrypt.hashSync(password, 10);
    await db.run("UPDATE users SET password = ? WHERE id = ?", [hashed, id]);
  }
  if (role) await db.run("UPDATE users SET role = ? WHERE id = ?", [role, id]);
  if (notify_email !== undefined)
    await db.run("UPDATE users SET notify_email = ? WHERE id = ?", [
      notify_email,
      id,
    ]);

  return NextResponse.json({ success: true });
}
