import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, setSessionCookie } from '../../../lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const relation = String(body.relation || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !relation) {
      return NextResponse.json({ error: 'Name and relation are required.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const supabase = getServiceClient();

    // 0. Make sure the family_members table can hold the link BEFORE creating
    // the auth user — otherwise a missing column would leave an orphan account.
    const probe = await supabase.from('family_members').select('user_id').limit(1);
    if (probe.error) {
      const probeMsg = (probe.error.message || '').toLowerCase();
      if (probeMsg.includes('user_id') || probeMsg.includes('does not exist')) {
        return NextResponse.json({
          error: 'Setup needed: run `alter table family_members add column user_id uuid;` in the Supabase SQL editor, then try again.',
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Could not reach the family members list: ' + probe.error.message }, { status: 500 });
    }

    // 1. Create the auth user (auto-confirmed so they can sign in immediately).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, relation, role: 'family' },
    });
    if (createErr || !created.user) {
      const msg = (createErr?.message || '').toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: 'An account with this email already exists — sign in instead.' }, { status: 409 });
      }
      return NextResponse.json({ error: createErr?.message || 'Could not create the account.' }, { status: 500 });
    }

    // 2. Link it to a family_members row so replies come from a real member.
    const { data: member, error: insertErr } = await supabase
      .from('family_members')
      .insert({ user_id: created.user.id, name, relation, email })
      .select('id, name, relation, email')
      .maybeSingle();
    if (insertErr) {
      const msg = (insertErr.message || '').toLowerCase();
      if (msg.includes('user_id') || msg.includes('does not exist')) {
        return NextResponse.json({
          error: 'Setup needed: run `alter table family_members add column user_id uuid;` in the Supabase SQL editor, then try again.',
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Account created but could not be linked to the family list: ' + insertErr.message }, { status: 500 });
    }

    // 3. Sign them in and hand the browser the session cookie.
    const { data: session, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr || !session.session) {
      return NextResponse.json({ error: 'Account created — please sign in manually.' }, { status: 500 });
    }
    const res = NextResponse.json({ member });
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
