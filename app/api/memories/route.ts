import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import { resolveSession, visibleProfileIds } from '../../lib/auth';

// Translate a saved note to English once, at save time, so the family
// dashboard (English-first) can show it without paying a per-view translation
// cost every time it polls. Grandma's device keeps speaking the original.
async function translateToEnglish(input: string, source: string): Promise<string> {
  const res = await fetch('https://api.sarvam.ai/translate', {
    method: 'POST',
    headers: {
      'api-subscription-key': process.env.SARVAM_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      source_language_code: source,
      target_language_code: 'en-IN',
      model: 'mayura:v1',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Sarvam translate failed: ${res.status}`);
  return data.translated_text;
}

// GET /api/memories -> the memories the signed-in user may see, newest first.
// Grandparent: their own; family: their linked grandparents'. Falls back to
// the unscoped list when the profile_id column hasn't been added yet.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const ids = await visibleProfileIds(resolved);
    if (resolved.role === 'family' && ids.length === 0) {
      return NextResponse.json([]);
    }
    const { data: initial, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    let data = initial;
    if (ids.length > 0 && !error) {
      const scoped = await supabase
        .from('memories')
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/memories -> save a new memory
// Body: { content: string, category?: 'date'|'todo'|'hospital'|'note',
//         source_language_code?: string (grandma's language, used to translate
//         the note to English for the family dashboard) }
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (resolved.role !== 'grandparent') {
      return NextResponse.json({ error: 'Only the grandparent can save memories.' }, { status: 403 });
    }
    const supabase = getSupabase();
    const body = await req.json();
    const content = (body.content || '').trim();
    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    const category = body.category || 'note';
    const sourceLang = body.source_language_code || 'ta-IN';

    // Translate once now (never per-view). Failure degrades gracefully to null
    // — the dashboard then shows the original text instead.
    let translatedText: string | null = null;
    if (sourceLang === 'en-IN') {
      translatedText = content;
    } else {
      try {
        translatedText = await translateToEnglish(content, sourceLang);
      } catch {
        // keep null — the family dashboard falls back to the original text
      }
    }

    // Insert, tolerating the translated_text column not existing yet (the
    // setup SQL hasn't been run) — the memory still saves, just untranslated.
    const insert = (withEn: boolean, withProfile: boolean) =>
      supabase
        .from('memories')
        .insert(
          withEn && withProfile
            ? { content, category, translated_text: translatedText, profile_id: resolved.userId, created_at: new Date().toISOString() }
            : withEn
            ? { content, category, translated_text: translatedText, created_at: new Date().toISOString() }
            : withProfile
            ? { content, category, profile_id: resolved.userId, created_at: new Date().toISOString() }
            : { content, category, created_at: new Date().toISOString() }
        )
        .select()
        .single();

    // Try the full insert (English translation + owner tag); drop columns one
    // at a time when they don't exist yet (translated_text / profile_id).
    let { data, error } = await insert(true, true);
    if (error && (error.message.toLowerCase().includes('translated_text') || error.message.toLowerCase().includes('does not exist'))) {
      ({ data, error } = await insert(false, true));
    }
    if (error && /profile_id|column/i.test(error.message || '')) {
      ({ data, error } = await insert(true, false));
    }
    if (error && (error.message.toLowerCase().includes('translated_text') || error.message.toLowerCase().includes('does not exist'))) {
      ({ data, error } = await insert(false, false));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/memories?id=<uuid> -> remove a memory the user can see (their
// own, or their linked grandparent's once the profile_id column exists).
export async function DELETE(req: NextRequest) {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const ids = await visibleProfileIds(resolved);
    const query = supabase.from('memories').delete().eq('id', id);
    if (ids.length > 0) {
      query.in('profile_id', ids);
    }
    const { error } = await query;
    if (error && /profile_id|column/i.test(error.message || '')) {
      // profile_id column missing — fall back to id-only delete.
      const retry = await supabase.from('memories').delete().eq('id', id);
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
