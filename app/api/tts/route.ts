import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

// In-memory cache so repeated reads of the same text (e.g. the Companion's
// fixed scripted replies) skip the ~1-2s Sarvam TTS call entirely.
const ttsCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      target_language_code = 'ta-IN',
      speaker = 'ishita',
      model = 'bulbul:v3',
      speech_sample_rate = '24000',
      output_audio_codec = 'wav',
    } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'No text to speak' }, { status: 400 });
    }

    const cacheKey = `${target_language_code}|${speaker}|${model}|${text.trim()}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) return NextResponse.json({ audio: cached });

    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text.trim(),
        target_language_code,
        speaker,
        model,
        speech_sample_rate,
        output_audio_codec,
      }),
    });

    const raw = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
    if (!res.ok) {
      throw new Error(`Sarvam TTS failed (${res.status}): ${JSON.stringify(data)}`);
    }

    const audio = Array.isArray(data.audios) ? data.audios[0] : null;
    if (!audio) throw new Error('No audio returned from Sarvam');

    ttsCache.set(cacheKey, audio);
    return NextResponse.json({ audio });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'TTS failed' }, { status: 500 });
  }
}
