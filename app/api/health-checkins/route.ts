import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import { resolveSession, visibleProfileIds } from '../../lib/auth';

// A reading is flagged when it falls outside safe ranges — the family
// dashboard highlights these so a high sugar or blood pressure is noticed
// without grandma having to say anything more.
function flagReading(metric: string, value: string): boolean {
  if (metric === 'sugar') {
    const n = parseFloat(value);
    return !isNaN(n) && (n < 70 || n > 180); // mg/dL
  }
  if (metric === 'bp') {
    const m = String(value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (m) {
      const sys = parseInt(m[1], 10);
      const dia = parseInt(m[2], 10);
      return sys > 140 || dia > 90 || sys < 90; // mmHg
    }
    return false;
  }
  return false;
}

// GET /api/health-checkins -> latest checkins, newest first. Requires a
// session; each role only sees their own (or their linked grandparents')
// readings once the profile_id column exists (migration), falling back to the
// unscoped list when it hasn't been added yet.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const ids = await visibleProfileIds(resolved);
    // A family member with no linked grandparents must see nothing — never the
    // whole shared feed.
    if (resolved.role === 'family' && ids.length === 0) {
      return NextResponse.json([]);
    }
    const { data: initial, error } = await supabase
      .from('health_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    let data = initial;
    if (ids.length > 0 && !error) {
      const scoped = await supabase
        .from('health_checkins')
        .select('*')
        .in('profile_id', ids)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!scoped.error) {
        ({ data } = scoped);
      }
      // profile_id column missing (migration not run) -> keep unscoped list.
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST /api/health-checkins -> record a new checkin. Only the grandparent
// can record readings (via the companion or the health page); family members
// only view.
// Body: { metric: 'sugar'|'bp'|'steps'|'water'|'mood', value: string, unit?, note? }
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (resolved.role !== 'grandparent') {
      return NextResponse.json({ error: 'Only the grandparent can record readings.' }, { status: 403 });
    }
    const supabase = getSupabase();
    const body = await req.json();
    if (!body.metric || body.value === undefined || body.value === null || body.value === '') {
      return NextResponse.json({ error: 'metric and value are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('health_checkins')
      .insert({
        metric: body.metric,
        value: String(body.value),
        unit: body.unit || null,
        note: body.note || null,
        flagged: flagReading(body.metric, String(body.value)),
        // Tag the owner so family dashboards only see their linked grandma's data.
        profile_id: resolved.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) {
      // profile_id column missing (migration not run) — insert without it.
      if (/profile_id|column/i.test(error.message || '')) {
        const retry = await supabase
          .from('health_checkins')
          .insert({
            metric: body.metric,
            value: String(body.value),
            unit: body.unit || null,
            note: body.note || null,
            flagged: flagReading(body.metric, String(body.value)),
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
