'use client';
import { Smile, HeartPulse, Activity, Footprints, Droplets, TrendingUp } from 'lucide-react';
import { T, translate, useLang } from '../../lib/i18n';

const STATS = [
  { label: 'health.bp', value: '120/80', unit: 'mmHg', icon: Activity, color: 'bg-brand-soft text-brand' },
  { label: 'health.hr', value: '72', unit: 'bpm', icon: HeartPulse, color: 'bg-terra-soft text-terra' },
  { label: 'health.steps', value: '4,350', unit: 'health.ofSteps', icon: Footprints, color: 'bg-accent-soft text-accent' },
  { label: 'health.water', value: '5', unit: 'health.ofGlasses', icon: Droplets, color: 'bg-sage-soft text-sage' },
];

const MOODS = ['😊', '😐', '😢'];

export default function HealthPage() {
  const lang = useLang();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="health.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="health.subtitle" /></p>
      </div>

      {/* Mood */}
      <section className="rounded-3xl border border-line bg-card p-6 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="health.mood" /></h2>
        <div className="flex items-center justify-center gap-6 py-2">
          {MOODS.map((m, i) => (
            <button
              key={m}
              className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-all hover:-translate-y-1 hover:shadow-soft ${
                i === 0 ? 'bg-accent-soft shadow-soft' : 'bg-card-soft'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
          <Smile size={16} className="text-accent" />
          <T k="health.feeling" />
        </p>
      </section>

      {/* Stats grid */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            className="anim-fade-up rounded-3xl border border-line bg-card p-5 shadow-soft"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-ink">
              {s.value} <span className="text-xs font-medium text-ink-muted">{translate(lang, s.unit)}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{translate(lang, s.label)}</p>
          </div>
        ))}
      </section>

      {/* Weekly trend placeholder */}
      <section className="rounded-3xl border border-line bg-card p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          <TrendingUp size={15} /> <T k="health.trend" />
        </h2>
        <div className="flex h-24 items-end gap-2">
          {[45, 70, 55, 85, 60, 95, 75].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-gradient-to-t from-brand-soft to-brand" style={{ height: `${h}%` }} />
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">{translate(lang, 'health.sample')}</p>
      </section>
    </div>
  );
}
