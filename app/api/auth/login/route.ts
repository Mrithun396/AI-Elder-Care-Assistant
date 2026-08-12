import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, setSessionCookie, memberForUser } from '../../../lib/auth';

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
    const member = await memberForUser(data.user);
    const res = NextResponse.json({ member });
    setSessionCookie(res, data.session.access_token, data.session.refresh_token);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Login failed — please try again.' }, { status: 500 });
  }
}
