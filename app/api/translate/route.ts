import { NextRequest, NextResponse } from 'next/server';
import { requireAnySession } from '../../lib/auth';
export const runtime = 'nodejs';

// In-memory cache so identical requests (e.g. the Companion's fixed scripted
// replies) skip the Sarvam call on repeat.
const translateCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    // Translation costs Sarvam credits — only signed-in users may use it.
    const session = await requireAnySession();
    if (!session) {
      return NextResponse.json({ error: 'Sign in to translate.' }, { status: 401 });
    }
    const { input, source_language_code = 'en-IN', target_language_code = 'ta-IN' } = await req.json();
    if (!input || !input.trim()) {
      return NextResponse.json({ error: 'No text to translate' }, { status: 400 });
    }
    // Sarvam rejects same-language requests (en-IN -> en-IN) with HTTP 400.
    // Return the text unchanged instead of failing.
    if (source_language_code === target_language_code) {
      return NextResponse.json({ translated_text: input.trim() });
    }

    // mode/model are fixed constants in this route, so source|target|input is unique.
    const cacheKey = `${source_language_code}|${target_language_code}|${input.trim()}`;
    const cached = translateCache.get(cacheKey);
    if (cached) return NextResponse.json({ translated_text: cached });

    const res = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: input.trim(),
        source_language_code,
        target_language_code,
        // 'mayura:v1' is the only model that supports colloquial modes.
        // 'modern-colloquial' makes translated replies (e.g. family -> grandma
        // in Tamil) sound like everyday spoken conversation instead of stiff
        // formal prose. Verified live: mayura:v1 + modern-colloquial -> 200.
        mode: 'modern-colloquial',
        model: 'mayura:v1',
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Sarvam translate failed: ${res.status}`);
    translateCache.set(cacheKey, data.translated_text);
    return NextResponse.json({ translated_text: data.translated_text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
