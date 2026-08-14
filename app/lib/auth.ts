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

// ---- Role-aware session + linked grandparents (family dashboard) ----

// A row from the `profiles` table — the identity record for both roles.
// Grandparent profiles carry a generated link_code that family members enter
// to link their account to the grandparent.
export type Profile = {
  id: string;
  role: 'grandparent' | 'family';
  name: string;
  language?: string | null;
  link_code?: string | null;
  linked_to?: string | null;
  created_at?: string;
};

// Resolve the profiles row for an auth user (or null for legacy accounts that
// predate the profiles table — e.g. old family members).
export async function profileForUser(user: { id: string }): Promise<Profile | null> {
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

// The grandparents a family account is ACTIVELY linked to — many-to-many via
// the family_links junction table. Pending (unconfirmed) links are excluded.
// Falls back to the legacy single profiles.linked_to column when the junction
// table hasn't been created yet, and treats links as active when the status
// column doesn't exist.
export async function linkedGrandparentsFor(userId: string): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  try {
    const { data: links, error } = await supabase
      .from('family_links')
      .select('grandparent_id, status')
      .eq('family_id', userId);
    if (error) {
      // The status column may be missing (migration not run) — treat all links
      // as active. Check this BEFORE the table-missing fallback: PostgREST's
      // "column ... does not exist" message also contains "does not exist".
      if (/status|column/i.test(error.message || '')) {
        const { data: plain } = await supabase.from('family_links').select('grandparent_id').eq('family_id', userId);
        return resolveGrandparents((plain || []).map((l) => ({ grandparent_id: l.grandparent_id })));
      }
      // family_links table itself doesn't exist yet — legacy single-link column.
      return linkedGrandparentsLegacy(userId);
    }
    return resolveGrandparents((links || []).filter((l) => !l.status || l.status === 'active'));
  } catch {
    return linkedGrandparentsLegacy(userId);
  }
}

async function resolveGrandparents(rows: { grandparent_id: string }[]): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  const ids = rows.map((l) => l.grandparent_id);
  if (ids.length === 0) return [];
  const { data: gps } = await supabase
    .from('profiles')
    .select('id, name, language')
    .in('id', ids);
  return (gps || []).map((g) => ({ id: g.id, name: g.name, language: g.language ?? null }));
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
// expired). Shared by the family and grandparent resolvers.
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

// Role-aware session resolution used by /api/auth/me and the family dashboard
// gate. A grandparent session resolves to their profile; any other session
// resolves to the family member shape (with the profile attached when one
// exists — legacy family accounts without a profiles row still work).
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
