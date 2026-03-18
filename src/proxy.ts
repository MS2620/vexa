import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "@/lib/session";
import { cookies } from "next/headers";

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  const isPwaOrPublicAsset =
    path === "/sw.js" ||
    path === "/manifest.webmanifest" ||
    path === "/favicon.ico" ||
    path === "/icon.png" ||
    path === "/badge.png" ||
    path === "/icon-192x192.png" ||
    path === "/icon-512x512.png" ||
    path === "/apple-touch-icon.png";

  if (
    path.startsWith("/_next") ||
    path.startsWith("/api") ||
    isPwaOrPublicAsset
  ) {
    return NextResponse.next();
  }

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
