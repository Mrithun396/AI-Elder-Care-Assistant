-- Run this in Supabase → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS credit_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  api_type text NOT NULL,
  tokens integer DEFAULT 0,
  estimated_cost numeric(10,4) DEFAULT 0.1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_created ON credit_usage(created_at);
