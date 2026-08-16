import { NextResponse } from 'next/server';
import { getSupabase } from '../../lib/supabase';
import { resolveSession } from '../../lib/auth';

// A med is "due" while we're inside a 3-minute window starting at its time.
// The client polls this every ~30s and announces each med once (tracked in
// localStorage), so reminders fire even when the Medicines page isn't open.
const DUE_WINDOW_MIN = 3;

// GET /api/reminders -> { due: [{ id, name, dose, time }] } — medicines whose
// time-of-day has just arrived. Requires a session (the reminder poller runs
// on grandma's device); empty when nothing is due or the table doesn't exist.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.from('medicines').select('id, name, dose, time');
    if (error) return NextResponse.json({ due: [] });
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const rows = (data || []) as { id: string; name: string; dose: string | null; time: string }[];
    const due = rows.filter((m) => {
      const mm = String(m.time || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!mm) return false;
      const t = parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10);
      const age = nowMin - t; // minutes since the scheduled time
      return age >= 0 && age < DUE_WINDOW_MIN;
    });
    return NextResponse.json({ due });
  } catch {
    // No Supabase configured (or any transient error) — never let a reminder
    // check crash the app; the client simply gets nothing due.
    return NextResponse.json({ due: [] });
  }
}
