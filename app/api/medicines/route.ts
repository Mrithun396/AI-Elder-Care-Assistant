import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

// Default medicines shown when the table is empty (first run) — identical to
// the hardcoded list the page used before medicines became editable.
const DEFAULTS = [
  { name: 'Metformin', dose: '500 mg', time: '08:00' },
  { name: 'Telmisartan', dose: '40 mg', time: '08:00' },
  { name: 'Vitamin D3', dose: '1,000 IU', time: '13:00' },
  { name: 'Aspirin', dose: '75 mg', time: '21:00' },
];

const COLS = 'id, name, dose, time, created_at';

// GET /api/medicines -> all medicines ordered by time of day.
// If the table is empty, the defaults are seeded first so the page always has
// a sensible list. If Supabase isn't configured, returns a 503 the client can
// use to fall back to its local defaults.
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('medicines')
      .select(COLS)
      .order('time', { ascending: true });
    if (error) {
      // Table missing or Supabase not configured — the page falls back to its
      // hardcoded list so the demo still works.
      if (
        error.message.includes('relation') ||
        error.message.includes('does not exist') ||
        error.message.includes('Could not find the table')
      ) {
        return NextResponse.json({ error: 'medicines table not found', fallback: true }, { status: 503 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    let rows = data || [];
    if (rows.length === 0) {
      const { data: seeded, error: seedErr } = await supabase
        .from('medicines')
        .insert(DEFAULTS)
        .select(COLS);
      if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 });
      rows = seeded || [];
    }
    return NextResponse.json(rows);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // No Supabase env vars at all — treat as "fall back to local defaults".
    if (msg.includes('not configured')) {
      return NextResponse.json({ error: msg, fallback: true }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/medicines -> add a medicine. Body: { name, dose?, time ('HH:MM') }
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const name = (body.name || '').trim();
    const time = (body.time || '').trim();
    if (!name || !time) {
      return NextResponse.json({ error: 'name and time are required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('medicines')
      .insert({ name, dose: body.dose || null, time })
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// PATCH /api/medicines -> edit a medicine. Body: { id, name?, dose?, time? }
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const patch: Record<string, string | null> = {};
    if (body.name !== undefined) patch.name = String(body.name).trim();
    if (body.dose !== undefined) patch.dose = body.dose === '' ? null : String(body.dose);
    if (body.time !== undefined) patch.time = String(body.time).trim();
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('medicines')
      .update(patch)
      .eq('id', body.id)
      .select(COLS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE /api/medicines?id=<uuid> -> remove a medicine
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
