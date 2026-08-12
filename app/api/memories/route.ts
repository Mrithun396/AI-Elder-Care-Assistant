import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

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
// Body: { content: string, category?: 'date'|'todo'|'hospital'|'note',
//         source_language_code?: string (grandma's language, used to translate
//         the note to English for the family dashboard) }
export async function POST(req: NextRequest) {
  try {
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
    const insert = (withEn: boolean) =>
      supabase
        .from('memories')
        .insert(
          withEn
            ? { content, category, translated_text: translatedText, created_at: new Date().toISOString() }
            : { content, category, created_at: new Date().toISOString() }
        )
        .select()
        .single();

    let { data, error } = await insert(true);
    if (
      error &&
      (error.message.toLowerCase().includes('translated_text') ||
        error.message.toLowerCase().includes('does not exist'))
    ) {
      ({ data, error } = await insert(false));
    }
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
