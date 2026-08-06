import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

// GET /api/emergency -> latest active alert (or null)
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data?.[0] ?? null);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// POST /api/emergency -> create a new active alert
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        sender_name: body.sender_name || 'Kamala',
        message: body.message || 'Emergency! I need help.',
        status: 'active',
        location: body.location || null, // Google Maps link from geolocation
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

// DELETE /api/emergency -> resolve all active alerts ("All clear")
export async function DELETE() {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('alerts')
      .update({ status: 'resolved' })
      .eq('status', 'active');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
