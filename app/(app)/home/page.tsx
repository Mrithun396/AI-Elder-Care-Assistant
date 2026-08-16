'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  MessageCircle,
  Sparkles,
  Pill,
  Siren,
  Bell,
  HeartPulse,
  ChevronRight,
} from 'lucide-react';
import { T, fmt, translate, useLang } from '../../lib/i18n';

const QUICK_CARDS = [
  {
    href: '/messages',
    title: 'home.sendMessage',
    subtitle: 'home.sendSub',
    icon: MessageCircle,
    color: 'bg-brand-soft text-brand',
  },
  {
    href: '/companion',
    title: 'home.talkToAI',
    subtitle: 'home.companionSub',
    icon: Sparkles,
    color: 'bg-accent-soft text-accent',
  },
  {
    href: '/medicines',
    title: 'nav.medicines',
    subtitle: 'home.medSub',
    icon: Pill,
    color: 'bg-sage-soft text-sage',
  },
  {
    href: '/emergency',
    title: 'home.emergencySos',
    subtitle: 'home.callFamilySub',
    icon: Siren,
    color: 'bg-terra-soft text-terra',
  },
];

export default function HomePage() {
  const lang = useLang();
  const [unread, setUnread] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState('');
  const [greetingKey, setGreetingKey] = useState('greeting.hello');

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
    );
    const h = new Date().getHours();
    setGreetingKey(h < 12 ? 'greeting.morning' : h < 17 ? 'greeting.afternoon' : 'greeting.evening');
    fetch('/api/messages')
      .then((r) => r.json())
      .then((data: unknown[]) => setUnread(Array.isArray(data) ? data.length : 0))
      .catch(() => setUnread(0));
  }, []);

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-accent p-6 sm:p-8 text-white shadow-soft">
        <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute right-16 top-2 h-16 w-16 rounded-full bg-white/5" />
        <p className="text-sm font-medium text-white/70">{todayLabel}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold"><T k={greetingKey} subClassName="text-white/75" /></h1>
        <p className="mt-1 text-sm text-white/80"><T k="home.ready" /></p>
      </section>

      {/* Quick cards */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="home.quickActions" /></h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {QUICK_CARDS.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className="anim-fade-up group rounded-3xl border border-line bg-card p-4 sm:p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${c.color}`}>
                <c.icon size={22} />
              </div>
              <p className="text-sm sm:text-[15px] font-semibold text-ink"><T k={c.title} /></p>
              <p className="mt-0.5 text-xs text-ink-muted">{translate(lang, c.subtitle)}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="home.recentActivity" /></h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/medicines" className="group rounded-3xl border border-line bg-card p-4 shadow-soft transition-colors hover:bg-card-soft">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sage-soft text-sage">
              <Pill size={18} />
            </div>
            <p className="text-sm font-semibold text-ink"><T k="home.todaysMedicines" /></p>
            <p className="mt-1 text-xs text-ink-muted">{translate(lang, 'home.medSummary')}</p>
          </Link>
          <Link href="/messages" className="group rounded-3xl border border-line bg-card p-4 shadow-soft transition-colors hover:bg-card-soft">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Bell size={18} />
            </div>
            <p className="text-sm font-semibold text-ink"><T k="home.unread" /></p>
            <p className="mt-1 text-xs text-ink-muted">
              {unread === null
                ? translate(lang, 'home.checking')
                : fmt(lang, unread === 1 ? 'home.history' : 'home.historyPlural', { n: unread })}
            </p>
          </Link>
          <Link href="/health" className="group rounded-3xl border border-line bg-card p-4 shadow-soft transition-colors hover:bg-card-soft">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <HeartPulse size={18} />
            </div>
            <p className="text-sm font-semibold text-ink"><T k="home.healthCheck" /></p>
            <p className="mt-1 text-xs text-ink-muted">{translate(lang, 'home.lastCheck')}</p>
          </Link>
        </div>
      </section>

      {/* Family dashboard link */}
      <Link
        href="/family"
        className="flex items-center justify-between rounded-3xl border border-line bg-card-soft p-4 text-sm font-semibold text-ink transition-colors hover:bg-card"
      >
        <span className="flex items-center gap-2">
          <HeartPulse size={16} className="text-brand" />
          <T k="home.openFamily" />
        </span>
        <ChevronRight size={18} className="text-ink-muted" />
      </Link>
    </div>
  );
}
