import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, setSessionCookie, generateLinkCode } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const language = String(body.language || 'ta-IN').trim();

    if (!name) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 0. Make sure the profiles table can hold the row BEFORE creating the
    // auth user — otherwise a missing table would leave an orphan account.
    const probe = await supabase.from('profiles').select('id').limit(1);
    if (probe.error) {
      const probeMsg = (probe.error.message || '').toLowerCase();
      if (probeMsg.includes('does not exist') || probeMsg.includes('could not find')) {
        return NextResponse.json({
          error: 'Setup needed: create a `profiles` table (id, role, name, language, link_code, linked_to) in the Supabase SQL editor, then try again.',
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Could not reach the profiles table: ' + probe.error.message }, { status: 500 });
    }

    // 1. Create the auth user (auto-confirmed so they can sign in immediately).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: 'grandparent' },
    });
    if (createErr || !created.user) {
      const msg = (createErr?.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'An account with this email already exists — sign in instead.' }, { status: 409 });
      }
      return NextResponse.json({ error: createErr?.message || 'Could not create the account.' }, { status: 500 });
    }

    // 2. Insert the profile row with a freshly generated family link code.
    const linkCode = await generateLinkCode();
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: created.user.id, role: 'grandparent', name, language, link_code: linkCode });
    if (insertErr) {
      // Clean up the orphan auth user so the email isn't locked to a broken account.
      await supabase.auth.admin.deleteUser(created.user.id);
      const msg = (insertErr.message || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find')) {
        return NextResponse.json({
          error: 'Setup needed: create a `profiles` table (id, role, name, language, link_code, linked_to) in the Supabase SQL editor, then try again.',
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Account created but could not be saved: ' + insertErr.message }, { status: 500 });
    }

    // 3. Sign them in and hand the browser the session cookie.
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !session.session) {
      return NextResponse.json({ error: 'Account created — please sign in manually.' }, { status: 500 });
    }
    const profile = { id: created.user.id, role: 'grandparent' as const, name, language, link_code: linkCode, linked_to: null };
    const res = NextResponse.json({ profile });
    setSessionCookie(res, session.session.access_token, session.session.refresh_token);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Could not create the account — please try again.' }, { status: 500 });
  }
}
