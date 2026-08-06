import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

// GET /api/memories -> all memories, newest first
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/memories -> save a new memory
// Body: { content: string, category?: 'date'|'todo'|'hospital'|'note' }
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    const { data, error } = await supabase
      .from('memories')
      .insert({
        content,
        category: body.category || 'note',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/memories?id=<uuid> -> remove a memory
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { error } = await supabase.from('memories').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
