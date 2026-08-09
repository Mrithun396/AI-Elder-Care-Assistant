'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageCircle,
  Sparkles,
  Pill,
  HeartPulse,
  Siren,
  Settings,
  HeartHandshake,
} from 'lucide-react';
import { LangProvider, T, useLang, translate } from '../lib/i18n';
import ReplyNotifier from './ReplyNotifier';
import MedicationReminder from './MedicationReminder';

const NAV = [
  { href: '/', label: 'nav.home', icon: Home, short: 'nav.home' },
  { href: '/messages', label: 'nav.messages', icon: MessageCircle, short: 'short.messages' },
  { href: '/companion', label: 'nav.companion', icon: Sparkles, short: 'short.companion' },
  { href: '/medicines', label: 'nav.medicines', icon: Pill, short: 'short.medicines' },
  { href: '/health', label: 'nav.health', icon: HeartPulse, short: 'short.health' },
  { href: '/emergency', label: 'nav.emergency', icon: Siren, short: 'short.emergency', danger: true },
  { href: '/settings', label: 'nav.settings', icon: Settings, short: 'short.settings' },
];

function NavLink({
  href,
  label,
  short,
  icon: Icon,
  active,
  danger,
  mobile,
}: {
  href: string;
  label: string;
  short: string;
  icon: typeof Home;
  active: boolean;
  danger?: boolean;
  mobile?: boolean;
}) {
  const lang = useLang();
  const cls = active
    ? 'bg-brand-soft text-brand font-semibold'
    : 'text-ink-muted hover:bg-card-soft hover:text-ink';
  const iconColor = danger && !active ? 'text-terra' : '';

  if (mobile) {
    return (
      <Link
        href={href}
        className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[9px] leading-tight transition-colors ${cls}`}
      >
        <Icon size={20} className={iconColor} strokeWidth={active ? 2.4 : 2} />
        {/* min-w-0 + w-full + truncate keep long Indic labels inside their cell */}
        <span className="block w-full truncate text-center">{translate(lang, short)}</span>
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm transition-colors ${cls}`}
    >
      <Icon size={18} className={iconColor} strokeWidth={active ? 2.4 : 2} />
      <T k={label} />
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement | null>(null);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  // The app shell scrolls its own <main> (the body never scrolls), so reset the
  // scroll position when navigating between tabs.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <LangProvider>
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-64 glass border-r border-line shrink-0">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-accent text-white shadow-soft">
            <HeartHandshake size={20} />
          </div>
          <div>
            <p className="text-base font-bold leading-tight text-ink">Bridge</p>
            <p className="text-[11px] text-ink-muted leading-tight"><T k="shell.tagline" /></p>
          </div>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3 py-2">
          {NAV.map((n) => (
            <NavLink key={n.href} {...n} active={isActive(n.href)} />
          ))}
        </nav>
        <div className="px-6 py-5 border-t border-line">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent text-sm font-bold">
              K
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-ink"><T k="shell.grandma" /></p>
              <p className="text-[11px] text-ink-muted"><T k="shell.role" /></p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile + content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden shrink-0 glass border-b border-line">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white">
              <HeartHandshake size={18} />
            </div>
            <p className="font-bold text-ink">Bridge</p>
          </div>
        </header>

        {/* Main content — the app's only scroll container. Scrolling here (not
            the body) keeps the browser chrome fixed, so the bottom nav never
            slides away on mobile. */}
        <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 lg:py-10 pb-14 lg:pb-10">{children}</div>
        </main>

        {/* Mobile bottom nav — always visible, never scrolls away */}
        <nav className="lg:hidden shrink-0 glass border-t border-line">
          <div className="grid grid-cols-7 px-2 py-1.5">
            {NAV.map((n) => (
              <NavLink key={n.href} {...n} active={isActive(n.href)} mobile />
            ))}
          </div>
        </nav>
      </div>

      {/* Slide-in notification when a family reply arrives */}
      <ReplyNotifier />
      {/* Medicine reminders fire on any screen when a dose is due */}
      <MedicationReminder />
    </div>
    </LangProvider>
  );
}
