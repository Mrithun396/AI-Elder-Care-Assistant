import { NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';

export const runtime = 'nodejs';

// Starting balance — adjust when you top up Sarvam credits.
const STARTING_BALANCE = 100;

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('credit_usage')
      .select('api_type, estimated_cost, tokens, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      // Table might not exist yet — return zeros instead of crashing
      if (error.message?.includes('does not exist')) {
        return NextResponse.json({
          balance: STARTING_BALANCE,
          used: 0,
          remaining: STARTING_BALANCE,
          total: STARTING_BALANCE,
          byType: {},
          recentUsage: [],
        });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const totalUsed = rows.reduce((s, r) => s + (r.estimated_cost || 0), 0);
    const byType: Record<string, { count: number; cost: number }> = {};
    for (const r of rows) {
      if (!byType[r.api_type]) byType[r.api_type] = { count: 0, cost: 0 };
      byType[r.api_type].count++;
      byType[r.api_type].cost += r.estimated_cost || 0;
    }

    return NextResponse.json({
      balance: STARTING_BALANCE,
      used: Math.round(totalUsed * 100) / 100,
      remaining: Math.round((STARTING_BALANCE - totalUsed) * 100) / 100,
      total: STARTING_BALANCE,
      byType,
      recentUsage: rows.slice(0, 20).map((r) => ({
        api_type: r.api_type,
        cost: r.estimated_cost,
        created_at: r.created_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
