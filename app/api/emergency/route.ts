import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import { resolveSession, visibleProfileIds } from '../../lib/auth';

// GET /api/emergency -> latest active alert visible to the signed-in user:
// grandparent sees their own, family sees their linked grandparents'. Falls
// back to the latest active alert when the profile_id column hasn't been added.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const ids = await visibleProfileIds(resolved);
    if (resolved.role === 'family' && ids.length === 0) {
      return NextResponse.json(null);
    }
    const { data: initial, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    let data = initial;
    if (ids.length > 0 && !error) {
      const scoped = await supabase
        .from('alerts')
        .select('*')
        .eq('status', 'active')
        .in('profile_id', ids)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!scoped.error) {
        ({ data } = scoped);
      }
      // profile_id column missing (migration not run) -> keep latest active.
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST /api/emergency -> create a new active alert. Only the grandparent can
// trigger an SOS.
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (resolved.role !== 'grandparent') {
      return NextResponse.json({ error: 'Only the grandparent can trigger an SOS.' }, { status: 403 });
    }
    const supabase = getSupabase();
    const body = await req.json();
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        sender_name: body.sender_name || 'Grandma',
        message: body.message || 'Emergency! I need help.',
        status: 'active',
        location: body.location || null, // Google Maps link from geolocation
        profile_id: resolved.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // profile_id column missing (migration not run) — insert without it.
      if (/profile_id|column/i.test(error.message || '')) {
        const retry = await supabase
          .from('alerts')
          .insert({
            sender_name: body.sender_name || 'Grandma',
            message: body.message || 'Emergency! I need help.',
            status: 'active',
            location: body.location || null,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        return NextResponse.json(retry.data);
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE /api/emergency -> resolve the active alert(s) the user can see
// ("All clear"). Grandparent clears their own; family clears their linked
// grandparents'. Falls back to resolving every active alert when the
// profile_id column hasn't been added yet.
export async function DELETE() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const ids = await visibleProfileIds(resolved);
    const query = supabase.from('alerts').update({ status: 'resolved' }).eq('status', 'active');
    if (ids.length > 0) {
      query.in('profile_id', ids);
    }
    const { error } = await query;
    if (error && /profile_id|column/i.test(error.message || '')) {
      // profile_id column missing — fall back to resolving all active alerts.
      const retry = await supabase.from('alerts').update({ status: 'resolved' }).eq('status', 'active');
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
