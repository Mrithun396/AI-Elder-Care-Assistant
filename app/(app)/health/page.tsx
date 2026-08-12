'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Smile,
  HeartPulse,
  Activity,
  Footprints,
  Droplets,
  TrendingUp,
  Minus,
  Plus,
  Gauge,
  TriangleAlert,
} from 'lucide-react';
import { LineChart, BpChart, FlagBadge } from '../../components/HealthCharts';
import { T, translate, fmt, useLang } from '../../lib/i18n';

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
  // Today's readings (for the daily check-in requirement).
  const [todayReadings, setTodayReadings] = useState<{ sugar?: Checkin; bp?: Checkin }>({});
  const [sugarInput, setSugarInput] = useState('');
  const [sysInput, setSysInput] = useState('');
  const [diaInput, setDiaInput] = useState('');
  const [savingSugar, setSavingSugar] = useState(false);
  const [savingBp, setSavingBp] = useState(false);
  const [sugarFlash, setSugarFlash] = useState(false);
  const [bpFlash, setBpFlash] = useState(false);
  const [checkinWarn, setCheckinWarn] = useState('');
  const [checkinError, setCheckinError] = useState('');

  // Load readings + derive today's sugar/BP and the 7-day trends after the
  // fetch (outside render, so date handling stays pure).
  const loadCheckins = useCallback(() => {
    fetch('/api/health-checkins')
      .then((r) => r.json())
      .then((data: Checkin[]) => {
        const list = Array.isArray(data) ? data : [];
        setCheckins(list);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const ts = start.getTime();
        const isToday = (c: Checkin) => c.created_at && new Date(c.created_at).getTime() >= ts;
        setTodayReadings({
          sugar: list.find((c) => c.metric === 'sugar' && isToday(c)),
          bp: list.find((c) => c.metric === 'bp' && isToday(c)),
        });
        const cutoff = Date.now() - 7 * 86400000;
        const recent = list.filter((c) => c.created_at && new Date(c.created_at).getTime() >= cutoff);
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
  }, []);

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
      loadCheckins();
    }, 0);
    return () => clearTimeout(id);
  }, [loadCheckins]);

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

  const clockTime = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const checkinDone = !!(todayReadings.sugar && todayReadings.bp);

  const saveSugar = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(sugarInput);
    if (isNaN(n) || n <= 0 || savingSugar) return;
    setSavingSugar(true);
    setCheckinError('');
    setCheckinWarn('');
    try {
      const res = await fetch('/api/health-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'sugar', value: String(n), unit: 'mg/dL' }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved = await res.json().catch(() => null);
      if (saved?.flagged) setCheckinWarn(translate(lang, 'health.checkinWarn'));
      setSugarInput('');
      setSugarFlash(true);
      setTimeout(() => setSugarFlash(false), 2500);
      await loadCheckins();
    } catch {
      setCheckinError(translate(lang, 'health.errSave'));
    } finally {
      setSavingSugar(false);
    }
  };

  const saveBp = async (e: React.FormEvent) => {
    e.preventDefault();
    const sys = parseInt(sysInput, 10);
    const dia = parseInt(diaInput, 10);
    if (isNaN(sys) || isNaN(dia) || sys < 50 || sys > 250 || dia < 30 || dia > 150 || savingBp) return;
    setSavingBp(true);
    setCheckinError('');
    setCheckinWarn('');
    try {
      const res = await fetch('/api/health-checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric: 'bp', value: `${sys}/${dia}`, unit: 'mmHg' }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved = await res.json().catch(() => null);
      if (saved?.flagged) setCheckinWarn(translate(lang, 'health.checkinWarn'));
      setSysInput('');
      setDiaInput('');
      setBpFlash(true);
      setTimeout(() => setBpFlash(false), 2500);
      await loadCheckins();
    } catch {
      setCheckinError(translate(lang, 'health.errSave'));
    } finally {
      setSavingBp(false);
    }
  };

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

      {/* Today's check-in — sugar & BP are required daily; the family dashboard sees them live */}
      <section className="rounded-3xl border-2 border-accent/50 bg-card p-6 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-ink">
            <HeartPulse size={16} className="text-brand" />
            <T k="health.checkin" />
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              checkinDone ? 'bg-sage-soft text-sage' : 'bg-terra-soft text-terra'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${checkinDone ? 'bg-sage' : 'bg-terra animate-pulse'}`} />
            <T k={checkinDone ? 'health.checkinDone' : 'health.checkinDue'} />
          </span>
        </div>
        {!checkinDone && (
          <p className="mb-4 text-xs text-ink-muted"><T k="health.checkinSub" /></p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Sugar */}
          <div className="rounded-2xl border border-line bg-card-soft p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink"><T k="health.sugar" /></p>
              {todayReadings.sugar ? (
                <span className="text-sm font-bold text-sage tabular-nums">
                  {todayReadings.sugar.value} mg/dL ✓
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-terra">
                  <T k="health.sugarPending" />
                </span>
              )}
            </div>
            {todayReadings.sugar ? (
              <p className="text-[11px] text-ink-muted">
                {fmt(lang, 'health.loggedAt', { t: clockTime(todayReadings.sugar.created_at) })}
              </p>
            ) : (
              <form onSubmit={saveSugar} className="flex gap-2">
                <input
                  value={sugarInput}
                  onChange={(e) => setSugarInput(e.target.value)}
                  placeholder={translate(lang, 'health.sugarPh')}
                  inputMode="decimal"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingSugar}
                  className="shrink-0 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                >
                  {savingSugar ? <T k="health.saving" /> : sugarFlash ? <T k="health.saved" /> : <T k="health.save" />}
                </button>
              </form>
            )}
          </div>

          {/* Blood pressure */}
          <div className="rounded-2xl border border-line bg-card-soft p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-ink"><T k="health.bp" /></p>
              {todayReadings.bp ? (
                <span className="text-sm font-bold text-sage tabular-nums">{todayReadings.bp.value} ✓</span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-terra">
                  <T k="health.bpPending" />
                </span>
              )}
            </div>
            {todayReadings.bp ? (
              <p className="text-[11px] text-ink-muted">
                {fmt(lang, 'health.loggedAt', { t: clockTime(todayReadings.bp.created_at) })}
              </p>
            ) : (
              <form onSubmit={saveBp} className="flex items-center gap-2">
                <input
                  value={sysInput}
                  onChange={(e) => setSysInput(e.target.value)}
                  placeholder={translate(lang, 'health.bpSysPh')}
                  inputMode="numeric"
                  className="w-16 rounded-xl border border-line bg-card px-3 py-2 text-center text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
                />
                <span className="text-sm font-bold text-ink-muted">/</span>
                <input
                  value={diaInput}
                  onChange={(e) => setDiaInput(e.target.value)}
                  placeholder={translate(lang, 'health.bpDiaPh')}
                  inputMode="numeric"
                  className="w-16 rounded-xl border border-line bg-card px-3 py-2 text-center text-sm text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingBp}
                  className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
                >
                  {savingBp ? <T k="health.saving" /> : bpFlash ? <T k="health.saved" /> : <T k="health.save" />}
                </button>
              </form>
            )}
          </div>
        </div>
        {checkinWarn && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-terra">
            <TriangleAlert size={13} /> {checkinWarn}
          </p>
        )}
        {checkinError && (
          <p className="mt-3 text-xs font-semibold text-terra">{checkinError}</p>
        )}
      </section>

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
            <LineChart data={trends.sugar} color="#C1502E" unit="mg/dL" emptyLabel={translate(lang, 'health.noData')} />
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 shadow-soft">
            <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5"><HeartPulse size={13} className="text-brand" /> <T k="health.bpTrend" /></span>
              {latestBP ? <span className="tabular-nums text-brand">{latestBP.sys}/{latestBP.dia}</span> : <span>—</span>}
            </p>
            <BpChart data={trends.bp} emptyLabel={translate(lang, 'health.noData')} sysLabel={translate(lang, 'health.sys')} diaLabel={translate(lang, 'health.dia')} />
          </div>
          <div className="rounded-3xl border border-line bg-card p-5 shadow-soft sm:col-span-2 lg:col-span-1">
            <p className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
              <span className="flex items-center gap-1.5"><Footprints size={13} className="text-accent" /> <T k="health.stepsTrend" /></span>
              <span className="tabular-nums text-accent">{trends.steps.length ? trends.steps[trends.steps.length - 1].value.toLocaleString() : '—'}</span>
            </p>
            <LineChart data={trends.steps} color="#E7A33E" unit="steps" emptyLabel={translate(lang, 'health.noData')} />
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
