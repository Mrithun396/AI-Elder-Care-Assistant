import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, getServiceClient, linkedGrandparentsFor } from '../../../lib/auth';

// Family members enter the grandparent's link code here. On success a row is
// added to family_links, so one family account can be linked to MANY
// grandparents. Falls back to the legacy single profiles.linked_to column if
// the junction table hasn't been created yet.
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

  // Make sure the family profile row exists first — it's the FK target for
  // family_links (for legacy accounts that predate the profiles table).
  await supabase.from('profiles').upsert(
    { id: resolved.userId, role: 'family', name: resolved.member.name },
    { onConflict: 'id' }
  );

  // The live-site model links instantly (no confirmation), so the row is
  // written as active — and a re-link upgrades an existing pending link to
  // active. If the status column doesn't exist yet, retry without it.
  let linkErr: { message: string } | null = null;
  const withStatus = await supabase
    .from('family_links')
    .upsert(
      { family_id: resolved.userId, grandparent_id: grandparent.id, status: 'active' },
      { onConflict: 'family_id,grandparent_id' }
    );
  if (withStatus.error && /status|column/i.test(withStatus.error.message || '')) {
    const withoutStatus = await supabase
      .from('family_links')
      .upsert(
        { family_id: resolved.userId, grandparent_id: grandparent.id },
        { onConflict: 'family_id,grandparent_id' }
      );
    linkErr = withoutStatus.error || null;
  } else {
    linkErr = withStatus.error || null;
  }
  if (linkErr && !/does not exist|could not find/i.test(linkErr.message || '')) {
    return NextResponse.json({ error: 'Could not save the link — please try again.' }, { status: 500 });
  }
  if (linkErr) {
    // Junction table missing — legacy single-link fallback.
    const { error: fallbackErr } = await supabase.from('profiles').upsert(
      { id: resolved.userId, role: 'family', name: resolved.member.name, linked_to: grandparent.id },
      { onConflict: 'id' }
    );
    if (fallbackErr) {
      return NextResponse.json({ error: 'Could not save the link — please try again.' }, { status: 500 });
    }
  }

  const linkedGrandparents = await linkedGrandparentsFor(resolved.userId);
  const res = NextResponse.json({ grandparent, linkedGrandparents });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
