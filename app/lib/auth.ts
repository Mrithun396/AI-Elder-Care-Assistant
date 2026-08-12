import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Family portal sessions are carried in a single HttpOnly cookie. The whole
// flow runs server-side with the service-role client (this app already does
// that everywhere), so the browser never needs the anon key for auth.
export const FAMILY_SESSION_COOKIE = 'bridge-family-session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type FamilyMember = {
  id: string;
  name: string;
  relation: string;
  email?: string | null;
};

type SessionPayload = { at: string; rt: string };

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, key);
}

export function parseSessionCookie(value: string | undefined): SessionPayload | null {
  if (!value) return null;
  try {
    const p = JSON.parse(value);
    if (p && typeof p.at === 'string' && typeof p.rt === 'string' && p.at && p.rt) {
      return { at: p.at, rt: p.rt };
    }
  } catch {
    // ignore malformed cookie
  }
  return null;
}

export function setSessionCookie(res: NextResponse, at: string, rt: string) {
  res.cookies.set(FAMILY_SESSION_COOKIE, JSON.stringify({ at, rt }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(FAMILY_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  return parseSessionCookie(store.get(FAMILY_SESSION_COOKIE)?.value);
}

// Resolve the family_members row for an auth user. Falls back to the auth
// user's metadata (and email) when no row exists yet — e.g. a user created
// before the user_id column was added to the table.
export async function memberForUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> | null;
}): Promise<FamilyMember> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('family_members')
    .select('id, name, relation, email')
    .eq('user_id', user.id)
    .maybeSingle();
  if (data) {
    return {
      id: data.id,
      name: data.name,
      relation: data.relation,
      email: data.email ?? user.email ?? null,
    };
  }
  return {
    id: user.id,
    name: String(user.user_metadata?.name || user.email || 'Family'),
    relation: String(user.user_metadata?.relation || 'Family'),
    email: user.email ?? null,
  };
}

// Validate the session cookie (refreshing the tokens when the access token
// has expired). Returns the logged-in family member plus the session tokens
// to persist — the caller decides whether to write the refreshed cookie.
export async function resolveFamilySession(): Promise<{
  member: FamilyMember;
  session: SessionPayload;
  refreshed: boolean;
} | null> {
  const payload = await readSessionCookie();
  if (!payload) return null;
  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase.auth.getUser(payload.at);
    if (data?.user && !error) {
      return { member: await memberForUser(data.user), session: payload, refreshed: false };
    }
  } catch {
    // fall through to refresh
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: payload.rt });
    if (error || !data.session || !data.user) return null;
    return {
      member: await memberForUser(data.user),
      session: { at: data.session.access_token, rt: data.session.refresh_token },
      refreshed: true,
    };
  } catch {
    return null;
  }
}

export { getServiceClient };
