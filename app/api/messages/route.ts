import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import { resolveSession } from '../../lib/auth';

// GET /api/messages — newest first. Family members (and no session) see the
// full conversation. A grandparent session sees ONLY messages addressed to
// them, sent by them, or legacy messages with no targeting at all — so with
// multiple grandparents each grandma gets her own thread.
export async function GET() {
  try {
    const supabase = getSupabase();
    const resolved = await resolveSession();
    let { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (resolved?.role === 'grandparent' && !error) {
      const me = resolved.userId;
      const filtered = await supabase
        .from('messages')
        .select('*')
        .or(
          `recipient_profile_id.eq.${me},sender_profile_id.eq.${me},and(recipient_profile_id.is.null,sender_profile_id.is.null)`
        )
        .order('created_at', { ascending: false })
        .limit(30);
      if (!filtered.error) {
        ({ data, error } = filtered);
      }
      // If the targeting columns don't exist yet (migration not run), the
      // filtered query errors and we keep the unfiltered list above.
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_name: body.sender_name || 'Kamala',
        sender_profile_id: body.sender_profile_id ?? null,
        recipient_id: body.recipient_id,
        recipient_profile_id: body.recipient_profile_id ?? null,
        original_text: body.original_text,
        original_language: body.original_language,
        translated_text: body.translated_text,
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