import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

// In-memory cache so repeated reads of the same text (e.g. the Companion's
// fixed scripted replies) skip the ~1-2s Sarvam TTS call entirely.
const ttsCache = new Map<string, string>();

// Sarvam renders line breaks as natural pauses in the audio — insert a break
// after each sentence-ending punctuation mark so the voice breathes at stops
// instead of rushing from sentence to sentence. Decimals (12.5) and numbers
// are never split because no whitespace follows the period in those cases.
function spaceOutText(text: string): string {
  return text
    .replace(/([.!?।])(\s+)/g, (m, p, ws) => `${p}\n${ws}`)
    .replace(/\n\s+/g, '\n')
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      target_language_code = 'ta-IN',
      speaker = 'ishita',
      model = 'bulbul:v3',
      pace = 0.85, // 0.5–2.0 — slower = calmer, more deliberate read for grandma
      temperature = 1.0, // 0.01–2.0 — higher = warmer, more expressive prosody
      speech_sample_rate = '24000',
      output_audio_codec = 'wav',
    } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'No text to speak' }, { status: 400 });
    }

    const clean = spaceOutText(text.trim());
    const paceN = Math.min(2, Math.max(0.5, Number(pace) || 0.85));
    const tempN = Math.min(2, Math.max(0.01, Number(temperature) || 1.0));

    const cacheKey = `${target_language_code}|${speaker}|${model}|${paceN}|${tempN}|${clean}`;
    const cached = ttsCache.get(cacheKey);
    if (cached) return NextResponse.json({ audio: cached });

    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: clean,
        target_language_code,
        speaker,
        model,
        pace: paceN,
        temperature: tempN,
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
