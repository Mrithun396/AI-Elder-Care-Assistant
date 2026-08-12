import { NextResponse } from 'next/server';
import { resolveFamilySession, setSessionCookie } from '../../../lib/auth';

export async function GET() {
  const resolved = await resolveFamilySession();
  if (!resolved) return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
  const res = NextResponse.json({ member: resolved.member });
  if (resolved.refreshed) {
    setSessionCookie(res, resolved.session.at, resolved.session.rt);
  }
  return res;
}
