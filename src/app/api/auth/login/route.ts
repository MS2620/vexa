import { NextResponse } from 'next/server';
import { openDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { username, password } = await req.json();
  const db = await openDb();
  
  const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
  
  if (user && bcrypt.compareSync(password, user.password)) {
    const session = await getSession();
    session.isLoggedIn = true;
    session.username = user.username;
    session.role = user.role;
    await session.save();
    
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
}
