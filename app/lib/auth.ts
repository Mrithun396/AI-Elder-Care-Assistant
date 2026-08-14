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

// A row from the `profiles` table — the identity record for BOTH roles.
// Grandparent profiles carry a generated link_code that family members enter
// to link their account to the grandparent (linked_to = grandparent profile id).
export type Profile = {
  id: string;
  role: 'grandparent' | 'family';
  name: string;
  language?: string | null;
  link_code?: string | null;
  linked_to?: string | null;
  created_at?: string;
};

export type SessionRole = 'grandparent' | 'family';

type SessionPayload = { at: string; rt: string };

// Unambiguous code alphabet — no 0/O/1/I so grandma can read it aloud.
const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LINK_CODE_LENGTH = 6;

// Generate a fresh 6-character link code that isn't already used by another
// grandparent profile (collisions are rare; retry a few times to be safe).
export async function generateLinkCode(): Promise<string> {
  const supabase = getServiceClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    let code = '';
    for (let i = 0; i < LINK_CODE_LENGTH; i++) {
      code += LINK_CODE_ALPHABET[Math.floor(Math.random() * LINK_CODE_ALPHABET.length)];
    }
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'grandparent')
      .eq('link_code', code)
      .maybeSingle();
    if (!data) return code;
  }
  // Last resort: accept a possible collision (still virtually unique).
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[Math.floor(Math.random() * LINK_CODE_ALPHABET.length)];
  }
  return code;
}

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

// Resolve the profiles row for an auth user (or null for legacy accounts that
// predate the profiles table — e.g. old family members).
export async function profileForUser(user: {
  id: string;
}): Promise<Profile | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, role, name, language, link_code, linked_to, created_at')
    .eq('id', user.id)
    .maybeSingle();
  return data ?? null;
}

export type LinkedGrandparent = {
  id: string;
  name: string;
  language?: string | null;
};

// The grandparents a family account is linked to — many-to-many via the
// family_links junction table. Falls back to the legacy single
// profiles.linked_to column when the junction table hasn't been created yet,
// so the app keeps working before the migration SQL is run.
export async function linkedGrandparentsFor(userId: string): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  try {
    const { data: links, error } = await supabase
      .from('family_links')
      .select('grandparent_id')
      .eq('family_id', userId);
    if (error) {
      // Table missing (migration not run yet) — degrade to the single link.
      if (/does not exist|could not find/i.test(error.message || '')) return linkedGrandparentsLegacy(userId);
      return linkedGrandparentsLegacy(userId);
    }
    const ids = (links || []).map((l) => l.grandparent_id);
    if (ids.length === 0) return [];
    const { data: gps } = await supabase
      .from('profiles')
      .select('id, name, language')
      .in('id', ids);
    return (gps || []).map((g) => ({ id: g.id, name: g.name, language: g.language ?? null }));
  } catch {
    return linkedGrandparentsLegacy(userId);
  }
}

async function linkedGrandparentsLegacy(userId: string): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('linked_to')
    .eq('id', userId)
    .maybeSingle();
  if (!profile?.linked_to) return [];
  const { data: gp } = await supabase
    .from('profiles')
    .select('id, name, language')
    .eq('id', profile.linked_to)
    .maybeSingle();
  return gp ? [{ id: gp.id, name: gp.name, language: gp.language ?? null }] : [];
}

type ResolvedUser = {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> | null };
  session: SessionPayload;
  refreshed: boolean;
};

// Validate the session cookie (refreshing the tokens when the access token has
// expired). Shared by the family and grandparent resolvers below.
async function resolveUser(payload: SessionPayload): Promise<ResolvedUser | null> {
  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase.auth.getUser(payload.at);
    if (data?.user && !error) {
      return { user: data.user, session: payload, refreshed: false };
    }
  } catch {
    // fall through to refresh
  }

  try {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: payload.rt });
    if (error || !data.session || !data.user) return null;
    return {
      user: data.user,
      session: { at: data.session.access_token, rt: data.session.refresh_token },
      refreshed: true,
    };
  } catch {
    return null;
  }
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
  const resolved = await resolveUser(payload);
  if (!resolved) return null;
  return {
    member: await memberForUser(resolved.user),
    session: resolved.session,
    refreshed: resolved.refreshed,
  };
}

// Role-aware session resolution used by /api/auth/me and the (app) layout gate.
// A grandparent session resolves to their profile; any other session resolves
// to the family member shape (with the profile attached when one exists).
export async function resolveSession(): Promise<
  | {
      role: 'grandparent';
      userId: string;
      profile: Profile;
      session: SessionPayload;
      refreshed: boolean;
    }
  | {
      role: 'family';
      userId: string;
      member: FamilyMember;
      profile: Profile | null;
      session: SessionPayload;
      refreshed: boolean;
    }
  | null
> {
  const payload = await readSessionCookie();
  if (!payload) return null;
  const resolved = await resolveUser(payload);
  if (!resolved) return null;
  const profile = await profileForUser(resolved.user);
  if (profile?.role === 'grandparent') {
    return {
      role: 'grandparent',
      userId: resolved.user.id,
      profile,
      session: resolved.session,
      refreshed: resolved.refreshed,
    };
  }
  return {
    role: 'family',
    userId: resolved.user.id,
    member: await memberForUser(resolved.user),
    profile,
    session: resolved.session,
    refreshed: resolved.refreshed,
  };
}

export { getServiceClient };
