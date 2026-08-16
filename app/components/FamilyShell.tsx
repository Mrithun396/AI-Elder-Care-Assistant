'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MessageCircle, HeartPulse, Siren, Settings as SettingsIcon, LogOut, MapPin } from 'lucide-react';

type Alert = {
  id: string;
  sender_name: string;
  message: string;
  location?: string;
  created_at?: string;
};

type Me = {
  member?: { name: string; relation?: string };
  linkedGrandparents?: { id: string; name: string }[];
};

const NAV = [
  { href: '/family/messages', label: 'Messages', icon: MessageCircle },
  { href: '/family/health', label: 'Health', icon: HeartPulse },
  { href: '/family/sos', label: 'SOS', icon: Siren, danger: true },
  { href: '/family/settings', label: 'Settings', icon: SettingsIcon },
];

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function FamilyShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('unauth');
        const d = await r.json();
        if (!cancelled && d.member) setMe(d);
      })
      .catch(() => {
        if (!cancelled) router.replace('/family/login');
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/emergency');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAlert(data && data.status === 'active' ? data : null);
      } catch {
        // keep current state on transient errors
      }
    };
    load();
    const id = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/family/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh bg-canvas text-ink" style={{ fontFamily: 'var(--font-geist-sans), var(--font-tamil), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }}>
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-brand">Family Dashboard</h1>
            <p className="text-sm text-ink-muted">
              {me?.member ? (
                <>Signed in as <strong className="text-ink">{me.member.name}</strong>{me.member.relation ? ` (${me.member.relation})` : ''}</>
              ) : (
                'Loading…'
              )}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-bold text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
          >
            <LogOut size={14} /> Log out
          </button>
        </div>

        {/* Slim live alert bar — full details on the SOS page */}
        {alert && (
          <Link
            href="/family/sos"
            className="mb-4 flex items-center gap-3 rounded-2xl bg-terra px-4 py-3 text-white shadow-lg transition-transform hover:-translate-y-0.5"
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-bold">
              🚨 Emergency — {alert.sender_name}{alert.created_at ? ` · ${fmtTime(alert.created_at)}` : ''}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-wide">
              <MapPin size={13} /> View
            </span>
          </Link>
        )}

        {/* Sub-nav */}
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {NAV.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? n.danger
                      ? 'bg-terra text-white'
                      : 'bg-brand text-white'
                    : 'border border-line bg-card text-ink-muted hover:bg-card-soft hover:text-ink'
                }`}
              >
                <n.icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
