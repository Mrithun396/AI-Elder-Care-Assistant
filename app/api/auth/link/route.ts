import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, getServiceClient } from '../../../lib/auth';

// Family members enter the grandparent's link code here. On success their
// profile's linked_to points at the grandparent's profile id, so the dashboard
// knows who they belong to.
export async function POST(req: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved || resolved.role !== 'family') {
    return NextResponse.json({ error: 'Sign in as a family member to link accounts.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const linkCode = String(body.linkCode || '').trim().toUpperCase();
  if (!linkCode) {
    return NextResponse.json({ error: 'Please enter the family code.' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Find the grandparent profile that owns this code.
  const { data: grandparent, error: findErr } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('role', 'grandparent')
    .eq('link_code', linkCode)
    .maybeSingle();
  if (findErr) {
    return NextResponse.json({ error: 'Could not look up that code — please try again.' }, { status: 500 });
  }
  if (!grandparent) {
    return NextResponse.json({ error: 'No grandparent found with that code. Double-check it and try again.' }, { status: 404 });
  }

  // Write (or create) the family member's profile with linked_to set. The
  // profile id is the auth user id; for legacy accounts (no profile row yet)
  // we create one keyed to the auth user id.
  const familyId = resolved.userId;
  const { error: upsertErr } = await supabase.from('profiles').upsert(
    {
      id: familyId,
      role: 'family',
      name: resolved.member.name,
      linked_to: grandparent.id,
    },
    { onConflict: 'id' }
  );
  if (upsertErr) {
    return NextResponse.json({ error: 'Could not save the link — please try again.' }, { status: 500 });
  }

  const res = NextResponse.json({ grandparent, linkedTo: grandparent.id });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
