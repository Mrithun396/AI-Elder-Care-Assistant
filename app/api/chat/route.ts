import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';

const TIMEOUT_MS = 30000;

// Human-readable language names + the affectionate term the companion uses to
// address grandma, per supported language (the 11 languages with Sarvam voices).
const LANG_NAMES: Record<string, string> = {
  'ta-IN': 'Tamil (தமிழ்)',
  'hi-IN': 'Hindi (हिन्दी)',
  'te-IN': 'Telugu (తెలుగు)',
  'ml-IN': 'Malayalam (മലയാളം)',
  'kn-IN': 'Kannada (ಕನ್ನಡ)',
  'bn-IN': 'Bengali (বাংলা)',
  'mr-IN': 'Marathi (मराठी)',
  'gu-IN': 'Gujarati (ગુજરાતી)',
  'pa-IN': 'Punjabi (ਪੰਜਾਬੀ)',
  'od-IN': 'Odia (ଓଡ଼ିଆ)',
  'en-IN': 'English',
};

const ADDRESS: Record<string, string> = {
  'ta-IN': 'பாட்டி',
  'hi-IN': 'दादी',
  'te-IN': 'అమ్మమ్మ',
  'ml-IN': 'അമ്മമ്മ',
  'kn-IN': 'ಅಜ್ಜಿ',
  'bn-IN': 'দিদিমা',
  'mr-IN': 'आजी',
  'gu-IN': 'દાદી',
  'pa-IN': 'ਦਾਦੀ',
  'od-IN': 'ଜେଜେମା',
  'en-IN': 'Paati',
};

// Which LLM drives the companion's conversations.
//  - 'sarvam'     : Sarvam's own open-source Indic model (sarvam-105b) via their
//                   chat API — it shares the SAME credits as the TTS/STT/
//                   translate calls, so one wallet covers the whole app.
//  - 'compatible' : any OpenAI-compatible chat-completions endpoint, pointed at
//                   with CHAT_BASE_URL — hosted OpenAI (gpt-4o-mini), a local
//                   open-weight model via Ollama/LM Studio (e.g. gpt-oss-20b,
//                   free, no API key), Groq, OpenRouter, etc.
//  - 'openai'     : shorthand for 'compatible' with the default OpenAI base URL.
//  - 'auto'       : Sarvam whenever its key is set (Indic-native + same wallet),
//                   otherwise the compatible endpoint when a key is set.
const provider = (process.env.CHAT_PROVIDER || 'auto').toLowerCase();
const compatBaseUrl = (process.env.CHAT_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
// Only reuse the OpenAI key when actually talking to OpenAI — a local Ollama/
// LM Studio endpoint (for open-weight models like gpt-oss) must never receive
// the hosted key.
const compatKey =
  process.env.CHAT_API_KEY ||
  (compatBaseUrl.includes('openai.com') ? process.env.OPENAI_API_KEY : undefined);
const compatModel = process.env.CHAT_MODEL || 'gpt-4o-mini';

const usingSarvam =
  provider === 'sarvam' || (provider === 'auto' && !!process.env.SARVAM_API_KEY);
// An explicit 'compatible'/'openai' counts as available even without a key
// (local Ollama needs none); 'auto' requires a key to avoid probing a dead
// endpoint.
const usingCompat =
  provider === 'compatible' ||
  provider === 'openai' ||
  (provider === 'auto' && !usingSarvam && !!compatKey);

// Availability probe — the Companion page checks this once on mount and only
// routes conversation through the LLM when a provider is actually configured.
export async function GET() {
  return NextResponse.json({ available: usingSarvam || usingCompat });
}

function buildMessages(
  messages: { role: string; content: string }[],
  target: string,
  context?: string
) {
  const langName = LANG_NAMES[target] || target;
  const address = ADDRESS[target] || 'Paati';
  const system = [
    `You are the AI companion in an elder-care app, speaking by voice to an elderly Indian grandmother whom you affectionately call ${address}.`,
    `Reply ONLY in ${langName}, matching the language of the conversation history.`,
    `Keep replies short, warm, and casual — 1 to 3 sentences, like a loving grandchild. No lists, no markdown, no emojis.`,
    `Use short, clean sentences with full stops — the reply is read aloud by a text-to-speech voice, and long run-on sentences sound rushed.`,
    `Always address her as ${address}, never "Grandma".`,
    `Be cheerful, patient, and caring. You may tell stories, jokes, or news, or just chat warmly. Stay in character; never mention you are an AI or a model.`,
  ].join('\n');

  // Real "memory of the day" injected by the client: today's health readings,
  // medicines taken, and saved notes. Reference it naturally only when
  // relevant — never invent facts that aren't listed here.
  const msgs: { role: string; content: string }[] = [{ role: 'system', content: system }];
  if (context && String(context).trim()) {
    msgs.push({
      role: 'system',
      content: `Real context about today for ${address}: ${String(context).trim()} Use it naturally when relevant; never invent health data not listed here.`,
    });
  }
  msgs.push(...messages);
  return msgs;
}

async function callSarvam(msgs: { role: string; content: string }[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.sarvam.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The app's key is a subscription key (sk_xxx) — Sarvam accepts it via
        // api-subscription-key; Bearer is included for token-auth accounts.
        'api-subscription-key': process.env.SARVAM_API_KEY!,
        Authorization: `Bearer ${process.env.SARVAM_API_KEY}`,
      },
      body: JSON.stringify({
        // Sarvam's open-source Indic LLM (128K context), tuned for Tamil,
        // Hindi, Telugu, Bengali and the other supported languages. Uses its
        // own env so CHAT_MODEL (the compatible-provider model) can't collide.
        model: process.env.SARVAM_MODEL || 'sarvam-105b',
        messages: msgs,
        temperature: 0.8,
        max_tokens: 300,
        // Reasoning disabled: sarvam-105b otherwise burns ~140 tokens of
        // reasoning BEFORE the reply, which ate the whole budget and left
        // `content` empty. A chat companion wants the direct answer anyway.
        reasoning_effort: null,
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Sarvam error (${res.status})`);
    }
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty reply from Sarvam chat');
    return NextResponse.json({ text });
  } finally {
    clearTimeout(timer);
  }
}

// Generic OpenAI-compatible chat caller. Handles hosted providers (OpenAI,
// Groq, OpenRouter) AND local servers (Ollama at http://localhost:11434/v1,
// LM Studio at http://localhost:1234/v1) — the latter need no API key.
async function callCompat(msgs: { role: string; content: string }[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (compatKey) headers.Authorization = `Bearer ${compatKey}`;
    const res = await fetch(`${compatBaseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: compatModel,
        messages: msgs,
        temperature: 0.8,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Chat error (${res.status})`);
    }
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty reply from model');
    return NextResponse.json({ text });
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, target_language_code = 'ta-IN', context } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 });
    }
    if (!usingSarvam && !usingCompat) {
      return NextResponse.json(
        { error: 'No chat provider configured (set SARVAM_API_KEY or CHAT_BASE_URL)' },
        { status: 501 }
      );
    }
    const msgs = buildMessages(messages, target_language_code, context);
    return usingSarvam ? await callSarvam(msgs) : await callCompat(msgs);
  } catch (err: unknown) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof Error && err.name === 'AbortError') {
      return NextResponse.json({ error: 'Chat timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: message || 'Chat failed' }, { status: 500 });
  }
}
