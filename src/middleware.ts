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

  // 1. Check if app needs setup by hitting our local API
  // Note: Middleware can't use sqlite directly, so we use a fetch call to an API route
  try {
    const setupCheckUrl = new URL("/api/setup/check", req.url);
    if (setupCheckUrl.hostname === "0.0.0.0") {
      setupCheckUrl.hostname = "127.0.0.1";
    }

    const setupRes = await fetch(setupCheckUrl, { cache: "no-store" });
    if (!setupRes.ok) {
      throw new Error(`Setup check failed with status ${setupRes.status}`);
    }

    const { isConfigured } = await setupRes.json();

    if (!isConfigured && path !== "/setup") {
      return NextResponse.redirect(new URL("/setup", req.url));
    }
    if (isConfigured && path === "/setup") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  } catch (e) {
    console.error("Middleware setup check failed", e);
  }

  // 2. Enforce Authentication
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
