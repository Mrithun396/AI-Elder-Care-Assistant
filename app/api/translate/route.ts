import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { input, source_language_code = 'en-IN', target_language_code = 'ta-IN' } = await req.json();
    if (!input || !input.trim()) {
      return NextResponse.json({ error: 'No text to translate' }, { status: 400 });
    }

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
        mode: 'formal',
        model: 'sarvam-translate:v1',
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Sarvam translate failed: ${res.status}`);
    return NextResponse.json({ translated_text: data.translated_text });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'Translation failed' }, { status: 500 });
  }
}
