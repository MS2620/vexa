import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
  role?: string;
}

export const sessionOptions = {
  password:
    process.env.SESSION_SECRET ||
    "complex_password_at_least_32_characters_long",
  cookieName: "vexa_session",
  cookieOptions: {
    // Only enforce HTTPS cookies when explicitly opted in — homelab setups typically use HTTP
    secure:
      process.env.NODE_ENV === "development" ||
      process.env.SECURE_COOKIES === "true",
    sameSite:
      process.env.NODE_ENV === "development" ? "none" : ("lax" as const),
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  return session;
}
