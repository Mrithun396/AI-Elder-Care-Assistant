'use client';
import { useState } from 'react';
import { Pill, Clock, CheckCircle2, CalendarClock } from 'lucide-react';
import { T, fmt, translate, useLang } from '../../lib/i18n';

const TODAY = [
  { name: 'Metformin', dose: '500 mg', time: '8:00 AM', taken: true, color: 'bg-sage-soft text-sage' },
  { name: 'Telmisartan', dose: '40 mg', time: '8:00 AM', taken: true, color: 'bg-brand-soft text-brand' },
  { name: 'Vitamin D3', dose: '1,000 IU', time: '1:00 PM', taken: false, color: 'bg-accent-soft text-accent' },
  { name: 'Aspirin', dose: '75 mg', time: '9:00 PM', taken: false, color: 'bg-terra-soft text-terra' },
];

const UPCOMING = [
  { name: 'Vitamin D3', dose: '1,000 IU', time: '1:00 PM', note: 'med.afterLunch' },
  { name: 'Aspirin', dose: '75 mg', time: '9:00 PM', note: 'med.afterDinner' },
];

const COMPLETED = [
  { name: 'Metformin', dose: '500 mg', time: '8:00 AM' },
  { name: 'Telmisartan', dose: '40 mg', time: '8:00 AM' },
];

export default function MedicinesPage() {
  const lang = useLang();
  const [today, setToday] = useState(TODAY);

  const toggle = (name: string) =>
    setToday((t) => t.map((m) => (m.name === name ? { ...m, taken: !m.taken } : m)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="med.title" /></h1>
        <p className="text-sm text-ink-muted">
          {fmt(lang, 'med.remaining', {
            remaining: today.filter((m) => !m.taken).length,
            taken: today.filter((m) => m.taken).length,
          })}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.today" /></h2>
        <div className="space-y-3">
          {today.map((m) => (
            <button
              key={m.name}
              onClick={() => toggle(m.name)}
              className="w-full rounded-3xl border border-line bg-card p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${m.color}`}>
                  <Pill size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{m.name}</p>
                  <p className="text-xs text-ink-muted">{m.dose} · {m.time}</p>
                </div>
                <span
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                    m.taken ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'
                  }`}
                >
                  {m.taken ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {m.taken ? translate(lang, 'med.taken') : translate(lang, 'med.pending')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.upcoming" /></h2>
        <div className="space-y-3">
          {UPCOMING.map((m) => (
            <div key={m.name} className="flex items-center gap-3 rounded-3xl border border-line bg-card-soft p-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <CalendarClock size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{m.name} · {m.dose}</p>
                <p className="text-xs text-ink-muted">{translate(lang, m.note)}</p>
              </div>
              <p className="text-sm font-bold text-accent">{m.time}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.completed" /></h2>
        <div className="space-y-3">
          {COMPLETED.map((m) => (
            <div key={m.name} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 opacity-70">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-sage">
                <CheckCircle2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink line-through decoration-ink-muted/50">{m.name} · {m.dose}</p>
                <p className="text-xs text-ink-muted">{m.time}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
