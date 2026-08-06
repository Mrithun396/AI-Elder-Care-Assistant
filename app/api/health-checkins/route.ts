import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

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

// GET /api/health-checkins -> latest checkins, newest first
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('health_checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST /api/health-checkins -> record a new checkin
// Body: { metric: 'sugar'|'bp'|'steps'|'water'|'mood', value: string, unit?, note? }
export async function POST(req: NextRequest) {
  try {
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
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
