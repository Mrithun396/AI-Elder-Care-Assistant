import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, setSessionCookie, profileForUser } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }
    const profile = await profileForUser(data.user);
    if (!profile || profile.role !== 'grandparent') {
      return NextResponse.json(
        { error: 'This account is not a grandparent account — use the family member sign-in.' },
        { status: 401 }
      );
    }
    const res = NextResponse.json({ profile });
    setSessionCookie(res, data.session.access_token, data.session.refresh_token);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Sign-in failed — please try again.' }, { status: 500 });
  }
}
