import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const SARVAM_TIMEOUT_MS = 45000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    // ?mode=transcribe returns only the transcript (used by the AI Companion,
    // which just needs to *listen* — no second-language translation).
    const transcribeOnly = req.nextUrl.searchParams.get('mode') === 'transcribe';
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    if (!audioFile) return NextResponse.json({ error: 'No audio file' }, { status: 400 });

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    // Pass through the browser's actual MIME type + filename so browsers that
    // record mp4 (webm fallback) still transcribe correctly on Sarvam's side.
    // Strip codec parameters (Chrome reports 'audio/webm;codecs=opus') — Sarvam
    // expects a clean type like 'audio/webm'.
    const fileType = (audioFile.type || 'audio/webm').split(';')[0].trim();
    const fileName = audioFile.name || (fileType.includes('mp4') ? 'recording.mp4' : 'recording.webm');

    const callSarvam = async (mode: 'transcribe' | 'translate') => {
      const fd = new FormData();
      fd.append('file', new Blob([buffer], { type: fileType }), fileName);
      fd.append('model', 'saaras:v3');
      fd.append('mode', mode);
      fd.append('language_code', 'unknown');

      const res = await fetchWithTimeout(
        'https://api.sarvam.ai/speech-to-text',
        {
          method: 'POST',
          headers: { 'api-subscription-key': process.env.SARVAM_API_KEY! },
          body: fd,
        },
        SARVAM_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(`Sarvam ${mode} failed: ${await res.text()}`);
      return res.json();
    };

    if (transcribeOnly) {
      const native = await callSarvam('transcribe');
      return NextResponse.json({
        original_text: native.transcript,
        original_language: native.language_code,
      });
    }

    const [native, translated] = await Promise.all([
      callSarvam('transcribe'),
      callSarvam('translate'),
    ]);

    return NextResponse.json({
      original_text: native.transcript,
      original_language: native.language_code,
      translated_text: translated.transcript,
    });
  } catch (err: any) {
    console.error(err);
    // Sarvam hung past the cap — signal a clean, localizable timeout instead of
    // leaking the raw AbortError text to the UI.
    if (err?.name === 'AbortError') {
      return NextResponse.json({ error: 'TIMEOUT' }, { status: 504 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}