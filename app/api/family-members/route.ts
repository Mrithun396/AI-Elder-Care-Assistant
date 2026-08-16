import { NextResponse } from 'next/server';
import { resolveSession, linkedFamilyMembersFor } from '../../lib/auth';

// GET /api/family-members — the family members the signed-in grandparent is
// ACTIVELY linked to (profile-shaped: id = profiles.id). Grandma's message
// composer and settings use this list, so it must never expose family members
// from other grandparents' links. Non-grandparent sessions get 401/empty.
export async function GET() {
  try {
    const resolved = await resolveSession();
    if (!resolved) {
      return NextResponse.json({ error: 'not authenticated' }, { status: 401 });
    }
    if (resolved.role !== 'grandparent') {
      return NextResponse.json([]);
    }
    const family = await linkedFamilyMembersFor(resolved.userId);
    return NextResponse.json(family);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}