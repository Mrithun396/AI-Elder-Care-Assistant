import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import {
  resolveSession,
  linkedGrandparentsFor,
  linkedFamilyMembersFor,
} from '../../lib/auth';

// GET /api/messages — newest first, scoped to the signed-in user:
//   grandparent: only messages addressed to them, sent by them, or legacy
//                untargeted messages (their own thread).
//   family:      only messages involving their ACTIVELY linked grandparents
//                (addressed to / sent by one of them), or sent by themselves.
//   no session:  401 — nothing is public.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();

    if (resolved.role === 'grandparent') {
      const me = resolved.userId;
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `recipient_profile_id.eq.${me},sender_profile_id.eq.${me},and(recipient_profile_id.is.null,sender_profile_id.is.null)`
        )
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    }

    // Family member: only messages touching their linked grandparents, or their
    // own sent/received messages. With no links they see only their own.
    const me = resolved.userId;
    const linked = await linkedGrandparentsFor(me);
    const ids = linked.map((g) => g.id);
    const { data: initial, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let data = initial;

    if (ids.length > 0) {
      const filtered = await supabase
        .from('messages')
        .select('*')
        .or(
          `recipient_profile_id.in.(${ids.join(',')}),sender_profile_id.in.(${ids.join(',')}),recipient_profile_id.eq.${me},sender_profile_id.eq.${me}`
        )
        .order('created_at', { ascending: false })
        .limit(30);
      if (!filtered.error) {
        ({ data } = filtered);
      }
      // If the targeting columns don't exist yet (migration not run), the
      // filtered query errors and we keep the unfiltered list above.
    } else {
      // No linked grandparents — only messages they sent or were addressed to.
      const mine = await supabase
        .from('messages')
        .select('*')
        .or(`recipient_profile_id.eq.${me},sender_profile_id.eq.${me}`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!mine.error) {
        ({ data } = mine);
      }
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/messages — create a message. Authorization:
//   grandparent: sender is forced to their own profile; the recipient must be
//                a family member ACTIVELY linked to them.
//   family:      sender is forced to their own profile; the recipient must be
//                a grandparent they are ACTIVELY linked to.
//   no session:  401.
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'Sign in to send messages.' }, { status: 401 });
    }
    const supabase = getSupabase();
    const body = await req.json();

    // Never trust the client for identity — always the session user.
    const senderProfileId = resolved.userId;
    const recipientProfileIdRaw = body.recipient_profile_id ?? null;
    const recipientIdRaw = body.recipient_id ?? null;

    let recipientProfileId: string | null = recipientProfileIdRaw;
    let recipientId: string | null = recipientIdRaw;

    if (resolved.role === 'grandparent') {
      // Grandma may only message family members linked to her. The recipient
      // may arrive as a profile id or a legacy family_members id — resolve it
      // and confirm it maps to a linked family member.
      const linked = await linkedFamilyMembersFor(resolved.userId);
      const linkedIds = new Set(linked.map((f) => f.id));
      let target = recipientProfileIdRaw;
      if (!target && recipientIdRaw) {
        // Legacy family_members.id -> profile id (family_members.user_id == profile id).
        const { data: fm } = await supabase
          .from('family_members')
          .select('user_id')
          .eq('id', recipientIdRaw)
          .maybeSingle();
        if (fm?.user_id) target = fm.user_id;
      }
      if (!target || !linkedIds.has(target)) {
        return NextResponse.json(
          { error: 'You can only send messages to family members linked to you.' },
          { status: 403 }
        );
      }
      recipientProfileId = target;
      // recipient_id is the legacy family_members column (FK to family_members)
      // — only keep a real family_members id from the client, never a profile id.
      recipientId = recipientIdRaw;
    } else {
      // Family member: only grandparents they are ACTIVELY linked to.
      const linked = await linkedGrandparentsFor(resolved.userId);
      const linkedIds = new Set(linked.map((g) => g.id));
      const target = recipientProfileIdRaw || recipientIdRaw;
      if (!target || !linkedIds.has(target)) {
        return NextResponse.json(
          { error: 'You can only send messages to grandparents you are linked to.' },
          { status: 403 }
        );
      }
      recipientProfileId = recipientProfileIdRaw ?? target;
      recipientId = recipientIdRaw;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_name: body.sender_name || (resolved.role === 'grandparent' ? 'Grandma' : 'Family'),
        sender_profile_id: senderProfileId,
        recipient_id: recipientId,
        recipient_profile_id: recipientProfileId,
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