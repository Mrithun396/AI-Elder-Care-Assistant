import { NextResponse } from 'next/server';
import { resolveSession, setSessionCookie, linkedGrandparentsFor } from '../../../lib/auth';

export async function GET() {
  const resolved = await resolveSession();
  if (!resolved) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });

  const base = { role: resolved.role };
  let body: Record<string, unknown>;
  if (resolved.role === 'grandparent') {
    body = { ...base, profile: resolved.profile };
  } else {
    // Family: the grandparents they're linked to (many-to-many), with each
    // grandma's name + language so replies can be translated for her.
    const linkedGrandparents = await linkedGrandparentsFor(resolved.userId);
    body = { ...base, member: resolved.member, profile: resolved.profile, linkedGrandparents };
  }

  const res = NextResponse.json(body);
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
