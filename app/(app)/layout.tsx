import { redirect } from 'next/navigation';
import AppShell from '../components/AppShell';
import { resolveSession } from '../lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The grandma side is now a signed-in experience: a visitor must be a
  // grandparent, otherwise send them to the role chooser at `/`.
  const resolved = await resolveSession();
  if (!resolved || resolved.role !== 'grandparent') {
    redirect('/');
  }
  return <AppShell>{children}</AppShell>;
}
