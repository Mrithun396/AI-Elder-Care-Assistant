import { NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, getServiceClient } from '../../../lib/auth';

export async function GET() {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const base = { role: resolved.role };
  let body: Record<string, unknown>;
  if (resolved.role === 'grandparent') {
    body = { ...base, profile: resolved.profile };
  } else {
    // Family: include the linked grandparent's name when linked, so the
    // dashboard can greet them without an extra round-trip.
    let linkedGrandparent: { id: string; name: string } | null = null;
    if (resolved.profile?.linked_to) {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', resolved.profile.linked_to)
        .maybeSingle();
      if (data) linkedGrandparent = { id: data.id, name: data.name };
    }
    body = { ...base, member: resolved.member, profile: resolved.profile, linkedGrandparent };
  }

  const res = NextResponse.json(body);
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
