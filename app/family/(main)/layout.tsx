import { redirect } from 'next/navigation';
import FamilyShell from '../../components/FamilyShell';
import { resolveSession } from '../../lib/auth';

// The family dashboard requires a family-member session; anyone else goes to
// the family login (which lives outside this route group, so it's not gated).
export default async function FamilyMainLayout({ children }: { children: React.ReactNode }) {
  const resolved = await resolveSession();
  if (!resolved || resolved.role !== 'family') {
    redirect('/family/login');
  }
  return <FamilyShell>{children}</FamilyShell>;
}
