import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
  role?: string;
}

export const sessionOptions = {
  // In a real app, this should be an env variable. 
  // For a homelab docker container, a hardcoded fallback is acceptable but not ideal.
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'debrid_manager_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};

export async function getSession() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
