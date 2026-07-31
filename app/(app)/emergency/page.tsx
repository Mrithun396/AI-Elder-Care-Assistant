'use client';
import { useState } from 'react';
import { Siren, Phone, User, PhoneCall } from 'lucide-react';
import { T, translate, useLang } from '../../lib/i18n';

const CONTACTS = [
  { name: 'Arun', relation: 'rel.son', phone: '+91 98765 43210' },
  { name: 'Priya', relation: 'rel.daughter', phone: '+91 91234 56780' },
  { name: 'Dr. Mehta', relation: 'rel.doctor', phone: '+91 90000 11122' },
];

export default function EmergencyPage() {
  const lang = useLang();
  const [pressed, setPressed] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const trigger = () => {
    setPressed(true);
    setCountdown(3);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="emergency.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="emergency.subtitle" /></p>
      </div>

      {/* SOS */}
      <section className="flex flex-col items-center rounded-3xl border border-line bg-card p-8 shadow-soft">
        {!pressed ? (
          <>
            <button
              onClick={trigger}
              className="sos-pulse flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full bg-terra text-white shadow-soft transition-transform hover:scale-105 active:scale-95"
            >
              <Siren size={44} />
              <span className="text-lg font-bold tracking-wide">SOS</span>
            </button>
            <p className="mt-6 text-sm font-semibold text-ink"><T k="emergency.tap" /></p>
            <p className="text-xs text-ink-muted">{translate(lang, 'emergency.sub')}</p>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-terra-soft text-terra">
              <span className="text-5xl font-bold">{countdown}</span>
            </div>
            <p className="mt-6 text-base font-bold text-ink">
              <T k={countdown > 0 ? 'emergency.calling' : 'emergency.sent'} />
            </p>
            <p className="text-xs text-ink-muted">
              {translate(lang, countdown > 0 ? 'emergency.cancel' : 'emergency.notified')}
            </p>
            {countdown === 0 && (
              <button
                onClick={() => setPressed(false)}
                className="mt-4 rounded-full border border-line px-6 py-2 text-sm font-semibold text-ink transition-colors hover:bg-card-soft"
              >
                <T k="emergency.done" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Contacts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="emergency.contacts" /></h2>
        <div className="space-y-3">
          {CONTACTS.map((c) => (
            <div key={c.name} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 shadow-soft">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <User size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-ink-muted">{translate(lang, c.relation)} · {c.phone}</p>
              </div>
              <button className="flex items-center gap-1.5 rounded-full bg-terra-soft px-4 py-2 text-xs font-bold text-terra transition-colors hover:bg-terra hover:text-white">
                <PhoneCall size={14} /> {translate(lang, 'emergency.call')}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-center text-xs text-ink-muted">
          <Phone size={12} /> {translate(lang, 'emergency.uiOnly')}
        </p>
      </section>
    </div>
  );
}
