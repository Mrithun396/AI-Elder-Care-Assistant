import { NextRequest, NextResponse } from 'next/server';
import {
  resolveSession,
  setSessionCookie,
  getServiceClient,
  linkedGrandparentsFor,
  pendingGrandparentsFor,
} from '../../../lib/auth';

// Family members enter the grandparent's link code here. The link starts as
// 'pending' — the grandparent confirms it on her side before it becomes
// active, so nobody can silently attach themselves to a grandparent. Falls
// back to the legacy single profiles.linked_to column (instant, no
// confirmation) if the status column hasn't been added yet.
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

  // Make sure the family profile row exists first — it's the FK target.
  await supabase.from('profiles').upsert(
    { id: resolved.userId, role: 'family', name: resolved.member.name },
    { onConflict: 'id' }
  );

  // Is there already a link (active or pending)?
  const { data: existing } = await supabase
    .from('family_links')
    .select('status')
    .eq('family_id', resolved.userId)
    .eq('grandparent_id', grandparent.id)
    .maybeSingle();
  if (existing?.status === 'active') {
    const [linkedGrandparents, pendingGrandparents] = await Promise.all([
      linkedGrandparentsFor(resolved.userId),
      pendingGrandparentsFor(resolved.userId),
    ]);
    return NextResponse.json({ grandparent, status: 'active', message: 'Already linked.', linkedGrandparents, pendingGrandparents });
  }
  if (existing?.status === 'pending') {
    const [linkedGrandparents, pendingGrandparents] = await Promise.all([
      linkedGrandparentsFor(resolved.userId),
      pendingGrandparentsFor(resolved.userId),
    ]);
    return NextResponse.json({
      grandparent,
      status: 'pending',
      message: 'Request already sent — waiting for your grandparent to confirm.',
      linkedGrandparents,
      pendingGrandparents,
    });
  }

  const { error: insertErr } = await supabase
    .from('family_links')
    .insert({ family_id: resolved.userId, grandparent_id: grandparent.id, status: 'pending' });
  if (insertErr) {
    // Status column missing (migration not run) — legacy instant link instead.
    if (/status|column/i.test(insertErr.message || '')) {
      const { error: fallbackErr } = await supabase.from('profiles').upsert(
        { id: resolved.userId, role: 'family', name: resolved.member.name, linked_to: grandparent.id },
        { onConflict: 'id' }
      );
      if (fallbackErr) {
        return NextResponse.json({ error: 'Could not save the link — please try again.' }, { status: 500 });
      }
      const [linkedGrandparents, pendingGrandparents] = await Promise.all([
        linkedGrandparentsFor(resolved.userId),
        pendingGrandparentsFor(resolved.userId),
      ]);
      return NextResponse.json({ grandparent, status: 'active', message: 'Linked.', linkedGrandparents, pendingGrandparents });
    }
    return NextResponse.json({ error: 'Could not save the link — please try again.' }, { status: 500 });
  }

  const [linkedGrandparents, pendingGrandparents] = await Promise.all([
    linkedGrandparentsFor(resolved.userId),
    pendingGrandparentsFor(resolved.userId),
  ]);
  const res = NextResponse.json({
    grandparent,
    status: 'pending',
    message: 'Request sent — your grandparent needs to confirm it on her device.',
    linkedGrandparents,
    pendingGrandparents,
  });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
