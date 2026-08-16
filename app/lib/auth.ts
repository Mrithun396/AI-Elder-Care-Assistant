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

// Resolve the session cookie to a lightweight { userId, role } pair, or null.
// Shared by the Sarvam-backed routes so anonymous visitors can't burn credits.
export async function requireAnySession(): Promise<{ userId: string; role: SessionRole } | null> {
  const resolved = await resolveSession();
  if (!resolved) return null;
  return { userId: resolved.userId, role: resolved.role };
}

// The profile ids whose records the resolved user may see / own:
//   grandparent -> just themselves
//   family      -> their actively linked grandparents
// Used to scope health/memories/alerts reads (and tag writes) when a
// profile_id column exists; callers fall back to unscoped when it doesn't.
export async function visibleProfileIds(resolved: { role: SessionRole; userId: string }): Promise<string[]> {
  if (resolved.role === 'grandparent') return [resolved.userId];
  const linked = await linkedGrandparentsFor(resolved.userId);
  return linked.map((g) => g.id);
}

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

// Family links carry a status ('pending' until grandma confirms, then
// 'active'). The column may not exist yet if the migration hasn't been run —
// these helpers detect that and treat every link as active.
type LinkRow = { grandparent_id: string; status?: string | null };

// The grandparents a family account is ACTIVELY linked to — many-to-many via
// the family_links junction table. Pending (unconfirmed) links are excluded.
// Falls back to the legacy single profiles.linked_to column when the junction
// table hasn't been created yet.
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
        const junction = (plain || []).map((l) => ({ grandparent_id: l.grandparent_id }));
        // The link route also writes the legacy profiles.linked_to column in
        // this pre-migration state — merge it so links aren't lost.
        const legacy = await linkedGrandparentsLegacy(userId);
        const seen = new Set(junction.map((l) => l.grandparent_id));
        for (const g of legacy) {
          if (!seen.has(g.id)) junction.push({ grandparent_id: g.id });
        }
        return resolveGrandparents(junction);
      }
      // family_links table itself doesn't exist yet — legacy single-link column.
      return linkedGrandparentsLegacy(userId);
    }
    return resolveGrandparents((links || []).filter((l) => !l.status || l.status === 'active'));
  } catch {
    return linkedGrandparentsLegacy(userId);
  }
}

// Pending (awaiting grandma's confirmation) links, from the family's view.
export async function pendingGrandparentsFor(userId: string): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  try {
    const { data: links, error } = await supabase
      .from('family_links')
      .select('grandparent_id, status')
      .eq('family_id', userId);
    if (error || !links) return [];
    return resolveGrandparents(links.filter((l: LinkRow) => l.status === 'pending'));
  } catch {
    return [];
  }
}

async function resolveGrandparents(rows: LinkRow[]): Promise<LinkedGrandparent[]> {
  const supabase = getServiceClient();
  const ids = rows.map((l) => l.grandparent_id);
  if (ids.length === 0) return [];
  const { data: gps } = await supabase
    .from('profiles')
    .select('id, name, language')
    .in('id', ids);
  return (gps || []).map((g) => ({ id: g.id, name: g.name, language: g.language ?? null }));
}

export type LinkedFamilyMember = { id: string; name: string };

// From a grandparent's view: the family members actively linked to them, and
// the pending link requests waiting for their confirmation.
export async function familyConnectionsFor(grandparentId: string): Promise<{
  active: LinkedFamilyMember[];
  pending: LinkedFamilyMember[];
}> {
  const supabase = getServiceClient();
  try {
    const { data, error } = await supabase
      .from('family_links')
      .select('family_id, status')
      .eq('grandparent_id', grandparentId);
    if (error || !data) {
      // Pre-migration (no status column / no junction table): links live on
      // the family profile's legacy linked_to column — surface them as active.
      if (/status|column|does not exist|could not find/i.test(error?.message || '')) {
        const { data: legacy } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'family')
          .eq('linked_to', grandparentId);
        return { active: (legacy || []).map((p) => ({ id: p.id, name: p.name })), pending: [] };
      }
      return { active: [], pending: [] };
    }
    const statusesKnown = data.some((r) => typeof r.status === 'string');
    const activeIds = statusesKnown
      ? data.filter((r) => r.status === 'active').map((r) => r.family_id)
      : data.map((r) => r.family_id);
    const pendingIds = statusesKnown ? data.filter((r) => r.status === 'pending').map((r) => r.family_id) : [];
    return {
      active: await resolveFamilyMembers(activeIds),
      pending: await resolveFamilyMembers(pendingIds),
    };
  } catch {
    return { active: [], pending: [] };
  }
}

async function resolveFamilyMembers(ids: string[]): Promise<LinkedFamilyMember[]> {
  const supabase = getServiceClient();
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
  return (profs || []).map((p) => ({ id: p.id, name: p.name }));
}

export type LinkedFamilyProfile = { id: string; name: string; relation: string };

// From a grandparent's view: the family members ACTIVELY linked to them, as
// profile-shaped rows (id = profiles.id) so messages can be addressed via
// recipient_profile_id. Relation comes from the legacy family_members table
// (joined on user_id == profiles.id) when available.
export async function linkedFamilyMembersFor(grandparentId: string): Promise<LinkedFamilyProfile[]> {
  const supabase = getServiceClient();
  let ids: string[] = [];
  try {
    const { data: links, error } = await supabase
      .from('family_links')
      .select('family_id, status')
      .eq('grandparent_id', grandparentId);
    if (error) {
      // Status column missing (migration not run) — treat all links as active,
      // and merge the legacy profiles.linked_to links the link route also writes.
      if (/status|column/i.test(error.message || '')) {
        const { data: plain } = await supabase
          .from('family_links')
          .select('family_id')
          .eq('grandparent_id', grandparentId);
        ids = (plain || []).map((l) => l.family_id);
        const { data: legacy } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'family')
          .eq('linked_to', grandparentId);
        const seen = new Set(ids);
        for (const p of legacy || []) {
          if (!seen.has(p.id)) ids.push(p.id);
        }
      } else if (/does not exist|could not find/i.test(error.message || '')) {
        // Junction table missing — legacy profiles.linked_to column instead.
        const { data: legacy } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('role', 'family')
          .eq('linked_to', grandparentId);
        return (legacy || []).map((p) => ({ id: p.id, name: p.name, relation: 'Family' }));
      }
    } else {
      const statusesKnown = (links || []).some((r) => typeof r.status === 'string');
      ids = statusesKnown
        ? (links || []).filter((r) => r.status === 'active').map((r) => r.family_id)
        : (links || []).map((r) => r.family_id);
    }
  } catch {
    return [];
  }
  if (ids.length === 0) return [];

  const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
  const nameMap = new Map((profs || []).map((p) => [p.id, p.name]));
  const { data: fams } = await supabase
    .from('family_members')
    .select('user_id, relation')
    .in('user_id', ids);
  const relMap = new Map((fams || []).map((f) => [f.user_id, f.relation]));
  return ids
    .filter((id) => nameMap.has(id))
    .map((id) => ({ id, name: nameMap.get(id)!, relation: relMap.get(id) || 'Family' }));
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
