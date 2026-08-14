import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, getServiceClient, linkedGrandparentsFor } from '../../../lib/auth';

// Remove a family <-> grandparent link. The family member stays signed in and
// can re-link later with the code.
export async function POST(req: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved || resolved.role !== 'family') {
    return NextResponse.json({ error: 'Sign in as a family member.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const grandparentId = String(body.grandparentId || '');
  if (!grandparentId) {
    return NextResponse.json({ error: 'Missing grandparent.' }, { status: 400 });
  }

  const supabase = getServiceClient();
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

  const linkedGrandparents = await linkedGrandparentsFor(resolved.userId);
  const res = NextResponse.json({ linkedGrandparents });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
