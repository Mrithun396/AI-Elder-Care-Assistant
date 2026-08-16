import { NextResponse } from 'next/server';
import {
  resolveSession,
  setSessionCookie,
  linkedGrandparentsFor,
  pendingGrandparentsFor,
  familyConnectionsFor,
} from '../../../lib/auth';

export async function GET() {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const base = { role: resolved.role };
  let body: Record<string, unknown>;
  if (resolved.role === 'grandparent') {
    // The grandma side: her profile + who's linked to her (and who's waiting).
    const connections = await familyConnectionsFor(resolved.userId);
    body = {
      ...base,
      profile: resolved.profile,
      linkedFamily: connections.active,
      pendingFamily: connections.pending,
    };
  } else {
    // Family: the grandparents they're linked to (many-to-many), with each
    // grandma's name + language for replies, plus pending (unconfirmed) ones.
    const [linkedGrandparents, pendingGrandparents] = await Promise.all([
      linkedGrandparentsFor(resolved.userId),
      pendingGrandparentsFor(resolved.userId),
    ]);
    body = { ...base, member: resolved.member, profile: resolved.profile, linkedGrandparents, pendingGrandparents };
  }

  const res = NextResponse.json(body);
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
