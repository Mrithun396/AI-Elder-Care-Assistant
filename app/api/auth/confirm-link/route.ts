import { NextRequest, NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, getServiceClient, familyConnectionsFor } from '../../../lib/auth';

// Grandma approves a pending family member's link request.
export async function POST(req: NextRequest) {
  const resolved = await resolveSession();
  if (!resolved || resolved.role !== 'grandparent') {
    return NextResponse.json({ error: 'Only the grandparent can confirm links.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const familyId = String(body.familyId || '');
  if (!familyId) {
    return NextResponse.json({ error: 'Missing family member.' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('family_links')
    .update({ status: 'active' })
    .eq('grandparent_id', resolved.userId)
    .eq('family_id', familyId)
    .eq('status', 'pending');

  if (error) {
    if (/status|column/i.test(error.message || '')) {
      return NextResponse.json({
        error: 'Setup needed: run the SQL to add the status column to family_links, then try again.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not confirm the link — please try again.' }, { status: 500 });
  }

  const connections = await familyConnectionsFor(resolved.userId);
  const res = NextResponse.json({ ok: true, linkedFamily: connections.active, pendingFamily: connections.pending });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
