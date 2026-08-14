import { NextRequest, NextResponse } from 'next/server';
import {
  resolveSession,
  setSessionCookie,
  getServiceClient,
  linkedGrandparentsFor,
  pendingGrandparentsFor,
  familyConnectionsFor,
} from '../../../lib/auth';

// Remove a family <-> grandparent link. Works from either side:
//   family member  -> body: { grandparentId }
//   grandparent    -> body: { familyId }
export async function POST(req: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const supabase = getServiceClient();

  if (resolved.role === 'grandparent') {
    const familyId = String(body.familyId || '');
    if (!familyId) return NextResponse.json({ error: 'Missing family member.' }, { status: 400 });
    const { error } = await supabase
      .from('family_links')
      .delete()
      .eq('grandparent_id', resolved.userId)
      .eq('family_id', familyId);
    if (error) return NextResponse.json({ error: 'Could not remove the link — please try again.' }, { status: 500 });
    const connections = await familyConnectionsFor(resolved.userId);
    const res = NextResponse.json({ linkedFamily: connections.active, pendingFamily: connections.pending });
    if (resolved.refreshed) setSessionCookie(res, resolved.session.at, resolved.session.rt);
    return res;
  }

  const grandparentId = String(body.grandparentId || '');
  if (!grandparentId) return NextResponse.json({ error: 'Missing grandparent.' }, { status: 400 });
  const { error } = await supabase
    .from('family_links')
    .delete()
    .eq('family_id', resolved.userId)
    .eq('grandparent_id', grandparentId);

  if (error && !/does not exist|could not find/i.test(error.message || '')) {
    return NextResponse.json({ error: 'Could not remove the link — please try again.' }, { status: 500 });
  }
  if (error) {
    // Legacy fallback: clear the single linked_to column if it points there.
    const { data: profile } = await supabase
      .from('profiles')
      .select('linked_to')
      .eq('id', resolved.userId)
      .maybeSingle();
    if (profile?.linked_to === grandparentId) {
      await supabase.from('profiles').update({ linked_to: null }).eq('id', resolved.userId);
    }
  }

  const [linkedGrandparents, pendingGrandparents] = await Promise.all([
    linkedGrandparentsFor(resolved.userId),
    pendingGrandparentsFor(resolved.userId),
  ]);
  const res = NextResponse.json({ linkedGrandparents, pendingGrandparents });
  if (resolved.refreshed) setSessionCookie(res, resolved.session.at, resolved.session.rt);
  return res;
}
