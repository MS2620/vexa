import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip middleware for API routes and static files
  if (path.startsWith("/_next") || path.startsWith("/api")) {
    return NextResponse.next();
  }

  // Enforce Authentication
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );

  const publicPaths = ["/login", "/setup"];
  if (
    !session.isLoggedIn &&
    !publicPaths.includes(path) &&
    !path.startsWith("/api")
  ) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
