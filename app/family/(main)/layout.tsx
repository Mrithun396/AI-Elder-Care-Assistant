import FamilyShell from '../../components/FamilyShell';

// The live demo has no family login — the dashboard opens directly, acting
// as the demo family member (Arun) with the grandparent linked on the
// server side.
export default function FamilyMainLayout({ children }: { children: React.ReactNode }) {
  return <FamilyShell>{children}</FamilyShell>;
}
