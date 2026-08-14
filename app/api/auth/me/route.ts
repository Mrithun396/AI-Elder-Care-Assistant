import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/auth';

// Live demo mode: there is no family login. Anyone visiting the family side
// automatically acts as the demo family member (Arun), and sees every
// grandparent profile in the database (the demo grandma, Kamala) as their
// linked grandparents.
export async function GET() {
  const supabase = getServiceClient();
  const { data: grandparents } = await supabase
    .from('profiles')
    .select('id, name, language')
    .eq('role', 'grandparent');

  return NextResponse.json({
    role: 'family',
    demo: true,
    member: { id: 'demo', name: 'Arun', relation: 'Son' },
    linkedGrandparents: (grandparents || []).map((g) => ({
      id: g.id,
      name: g.name,
      language: g.language ?? null,
    })),
  });
}
