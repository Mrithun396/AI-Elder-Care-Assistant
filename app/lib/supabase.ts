import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Created lazily (not at module scope) so `next build` never hard-crashes when
// env vars are missing — the client is only built when a request actually
// arrives, and a clear error is thrown at runtime if config is absent.
export function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return createClient(url, key);
}

// ---------- Credit tracking ----------
// Sarvam AI has no credits API, so we track usage locally. Each successful
// API call logs its type + estimated cost; /api/credits aggregates it.
// Costs are rough estimates based on Sarvam's pay-as-you-go pricing.
const CREDIT_COSTS: Record<string, number> = {
  chat: 0.5,       // LLM completion — most expensive
  tts: 0.1,        // text-to-speech
  stt: 0.1,        // speech-to-text
  translate: 0.05, // translation
};

export async function logCreditUsage(
  apiType: string,
  tokens = 0
): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from('credit_usage').insert({
      api_type: apiType,
      tokens,
      estimated_cost: CREDIT_COSTS[apiType] ?? 0.1,
    });
  } catch {
    // Best-effort — never block a response for tracking failures
  }
}
