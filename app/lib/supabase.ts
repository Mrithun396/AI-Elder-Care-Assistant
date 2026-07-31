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
