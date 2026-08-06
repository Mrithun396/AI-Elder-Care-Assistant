'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Smile,
  HeartPulse,
  Activity,
  Footprints,
  Droplets,
  TrendingUp,
  Minus,
  Plus,
  TriangleAlert,
  Gauge,
} from 'lucide-react';
import { T, translate, useLang } from '../../lib/i18n';

const MOODS = [
  { emoji: '😊', label: 'great' },
  { emoji: '😐', label: 'okay' },
  { emoji: '😢', label: 'unwell' },
];

type Day = { date: string; mood: string | null; water: number; steps: number };

type Checkin = {
  id: string;
  metric: string;
  value: string;
  unit?: string;
  note?: string;
  created_at?: string;
  flagged?: boolean;
};

// Local-time YYYY-MM-DD (not UTC) so "today" stays correct for India (+5:30)
function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function readAll(): Record<string, Day> {
  try {
    return JSON.parse(localStorage.getItem('bridge-health') || '{}');
  } catch {
    return {};
  }
}

function parseBP(value: string): { sys: number; dia: number } | null {
  const m = String(value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  return { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) };
}

// Hand-rolled SVG sparkline — no chart library needed, and it renders crisply
// at any width. One line + soft area fill + dots with hover titles.
function LineChart({
  data,
  color,
  unit = '',
  height = 92,
}: {
  data: { value: number; time?: string }[];
  color: string;
  unit?: string;
  height?: number;
}) {
  const W = 320;
  const H = height;
  const P = 10;
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-muted"><T k="health.noData" /></p>;
  }
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${P},${H - P} ${line} ${x(data.length - 1).toFixed(1)},${H - P}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="trend">
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} className="cursor-pointer">
            <title>
              {`${v}${unit ? ' ' + unit : ''}${data[i].time ? ' · ' + new Date(data[i].time!).toLocaleString() : ''}`}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-ink-muted">
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span className="font-bold text-ink">{vals[vals.length - 1]}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>
    </div>
  );
}

// Blood pressure is two values — systolic + diastolic — so it gets two lines.
// Small "needs attention" badge shown on flagged readings.
function FlagBadge({ flagged }: { flagged?: boolean }) {
  if (!flagged) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-bold text-terra">
      <TriangleAlert size={11} /> <T k="health.needsAttention" />
    </span>
  );
}

function BpChart({ data }: { data: { sys: number; dia: number; time?: string }[] }) {
  const W = 320;
  const H = 92;
  const P = 10;
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-muted"><T k="health.noData" /></p>;
  }
  const all = data.flatMap((d) => [d.sys, d.dia]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = (key: 'sys' | 'dia') =>
    data.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="blood pressure trend">
        <polyline
          points={line('sys')}
          fill="none"
          stroke="#C1502E"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line('dia')}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.sys)} r={3.5} fill="#C1502E">
              <title>{`sys ${d.sys}${d.time ? ' · ' + new Date(d.time).toLocaleString() : ''}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(d.dia)} r={3.5} fill="#3B82F6">
              <title>{`dia ${d.dia}${d.time ? ' · ' + new Date(d.time).toLocaleString() : ''}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-ink-muted">
        <span>{min}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#C1502E]" /><T k="health.sys" /></span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3B82F6]" /><T k="health.dia" /></span>
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const lang = useLang();
  const [today, setToday] = useState<Day>({ date: dayKey(), mood: null, water: 0, steps: 0 });
  const [week, setWeek] = useState<Day[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  // Readings from the last 7 days, oldest first, split per metric for the
  // charts (computed when the data loads — see the effect below — not during render)
  const [trends, setTrends] = useState<{
    sugar: { value: number; time?: string }[];
    bp: { sys: number; dia: number; time?: string }[];
    steps: { value: number; time?: string }[];
  }>({ sugar: [], bp: [], steps: [] });

  useEffect(() => {
    // Deferred one tick so state updates don't cascade inside the effect body.
    const id = setTimeout(() => {
      const all = readAll();
      const key = dayKey();
      setToday(all[key] || { date: key, mood: null, water: 0, steps: 0 });
      const days: Day[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = dayKey(d);
        days.push(all[k] || { date: k, mood: null, water: 0, steps: 0 });
      }
      setWeek(days);
      // Real readings from Supabase (spoken to the companion, or logged here)
      fetch('/api/health-checkins')
        .then((r) => r.json())
        .then((data: Checkin[]) => {
          const list = Array.isArray(data) ? data : [];
          setCheckins(list);
          // 7-day trends computed here (outside render) so date handling is pure
          const cutoff = Date.now() - 7 * 86400000;
          const recent = list.filter(
            (c) => c.created_at && new Date(c.created_at).getTime() >= cutoff
          );
          const byTime = (a: Checkin, b: Checkin) =>
            new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime();
          const sugar = recent
            .filter((c) => c.metric === 'sugar')
            .sort(byTime)
            .map((c) => ({ value: parseFloat(c.value), time: c.created_at }))
            .filter((p) => !isNaN(p.value));
          const bp = recent
            .filter((c) => c.metric === 'bp')
            .sort(byTime)
            .map((c) => ({ ...parseBP(c.value)!, time: c.created_at }))
            .filter((p) => p.sys !== undefined && p.dia !== undefined);
          const steps = recent
            .filter((c) => c.metric === 'steps')
            .sort(byTime)
            .map((c) => ({ value: parseFloat(c.value), time: c.created_at }))
            .filter((p) => !isNaN(p.value));
          setTrends({ sugar, bp, steps });
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const save = (next: Day) => {
    setToday(next);
    try {
      const all = readAll();
      all[next.date] = next;
      localStorage.setItem('bridge-health', JSON.stringify(all));
    } catch {}
    // Push today's numbers to Supabase so the family dashboard can see them.
    const push = (metric: string, value: string, unit?: string) => {
      fetch('/api/health-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric, value, unit }),
      }).catch(() => {});
    };
    if (next.steps > 0) push('steps', String(next.steps), 'steps');
    if (next.water > 0) push('water', String(next.water), 'glasses');
    if (next.mood) push('mood', next.mood);
  };

  const setMood = (label: string) => save({ ...today, mood: today.mood === label ? null : label });

  const addWater = (delta: number) =>
    save({ ...today, water: Math.max(0, Math.min(12, today.water + delta)) });

  const addSteps = (delta: number) =>
    save({ ...today, steps: Math.max(0, today.steps + delta) });

  const moodEmoji = MOODS.find((m) => m.label === today.mood)?.emoji || null;
  const maxWater = Math.max(1, ...week.map((d) => d.water));

  // Newest-first list -> latest reading per metric
  const latest = useMemo(() => {
    const m: Record<string, Checkin> = {};
    for (const c of checkins) if (!m[c.metric]) m[c.metric] = c;
    return m;
  }, [checkins]);

  const latestBP = latest.bp ? parseBP(latest.bp.value) : null;

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
          {MOODS.map((m) => (
            <button
              key={m.label}
              onClick={() => setMood(m.label)}
              aria-pressed={today.mood === m.label}
              className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition-all hover:-translate-y-1 hover:shadow-soft ${
                today.mood === m.label ? 'bg-accent-soft shadow-soft ring-2 ring-accent' : 'bg-card-soft'
              }`}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
          <Smile size={16} className="text-accent" />
          {moodEmoji
            ? translate(lang, `health.moodLog.${today.mood}`)
            : translate(lang, 'health.feeling')}
        </p>
      </section>

      {/* Latest readings — real data from the companion / health log */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="anim-fade-up rounded-3xl border border-line bg-card p-5 shadow-soft">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Gauge size={20} />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {latestBP ? `${latestBP.sys}/${latestBP.dia}` : '—'}
            {latestBP && <span className="text-xs font-medium text-ink-muted"> mmHg</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{translate(lang, 'health.bp')}</p>
          <FlagBadge flagged={latest.bp?.flagged} />
        </div>

        <div className="anim-fade-up rounded-3xl border border-line bg-card p-5 shadow-soft">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-terra-soft text-terra">
            <Activity size={20} />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {latest.sugar ? latest.sugar.value : '—'}
            {latest.sugar && <span className="text-xs font-medium text-ink-muted"> mg/dL</span>}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{translate(lang, 'health.sugar')}</p>
          <FlagBadge flagged={latest.sugar?.flagged} />
        </div>

        <div className="anim-fade-up rounded-3xl border border-line bg-card p-5 shadow-soft">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Footprints size={20} />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">{today.steps.toLocaleString()}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="flex-1 text-xs text-ink-muted">{translate(lang, 'health.steps')}</p>
            <button
              onClick={() => addSteps(-500)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
              aria-label="-500"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => addSteps(500)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-accent transition-colors hover:bg-accent hover:text-white"
              aria-label="+500"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>

        <div className="anim-fade-up rounded-3xl border border-line bg-card p-5 shadow-soft">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-sage">
            <Droplets size={20} />
          </div>
          <p className="text-2xl font-bold text-ink tabular-nums">
            {today.water} <span className="text-xs font-medium text-ink-muted">{translate(lang, 'health.ofGlasses')}</span>
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="flex-1 text-xs text-ink-muted">{translate(lang, 'health.water')}</p>
            <button
              onClick={() => addWater(-1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
              aria-label="-1"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => addWater(1)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sage-soft text-sage transition-colors hover:bg-sage hover:text-white"
              aria-label="+1"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </section>

      {/* Real trends from spoken/recorded readings */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          <TrendingUp size={15} /> <T k="health.trend" />
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-line bg-card p-5 shadow-soft">
            <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5"><Activity size={13} className="text-terra" /> <T k="health.sugarTrend" /></span>
              <span className="tabular-nums text-terra">{trends.sugar.length ? trends.sugar[trends.sugar.length - 1].value : '—'}</span>
            </p>
            <LineChart data={trends.sugar} color="#C1502E" unit="mg/dL" />
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 shadow-soft">
            <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5"><HeartPulse size={13} className="text-brand" /> <T k="health.bpTrend" /></span>
              {latestBP ? <span className="tabular-nums text-brand">{latestBP.sys}/{latestBP.dia}</span> : <span>—</span>}
            </p>
            <BpChart data={trends.bp} />
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 shadow-soft sm:col-span-2 lg:col-span-1">
            <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5"><Footprints size={13} className="text-accent" /> <T k="health.stepsTrend" /></span>
              <span className="tabular-nums text-accent">{trends.steps.length ? trends.steps[trends.steps.length - 1].value.toLocaleString() : '—'}</span>
            </p>
            <LineChart data={trends.steps} color="#E7A33E" unit="steps" />
          </div>
        </div>
      </section>

      {/* 7-day water trend (logged on this page) */}
      <section className="rounded-3xl border border-line bg-card p-6 shadow-soft">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink-muted">
          <Droplets size={15} /> {translate(lang, 'health.water')} — <T k="health.trend" />
        </h2>
        <div className="flex h-28 items-end gap-2">
          {week.map((d) => {
            const h = d.water === 0 ? 4 : Math.round((d.water / maxWater) * 100);
            return (
              <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-sage-soft to-sage transition-all group-hover:from-accent-soft group-hover:to-accent"
                    style={{ height: `${Math.max(4, h)}%` }}
                    title={`${d.water} ${translate(lang, 'health.ofGlasses')}`}
                  />
                </div>
                <span className="text-[9px] font-semibold text-ink-muted">
                  {new Date(d.date).toLocaleDateString(undefined, { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">
          {translate(lang, 'health.waterWeek')}
        </p>
      </section>
    </div>
  );
}
