'use client';
import { useCallback, useEffect, useState } from 'react';
import { LineChart, BpChart, type BpPoint } from '../../../components/HealthCharts';

type Checkin = {
  id: string;
  metric: string;
  value: string;
  unit?: string;
  note?: string;
  flagged?: boolean;
  created_at?: string;
};

type Memory = {
  id: string;
  content: string;
  translated_text?: string | null;
  category?: string;
  created_at?: string;
};

const CHECKIN_META: Record<string, { label: string; icon: string }> = {
  sugar: { label: 'Sugar', icon: '🩸' },
  bp: { label: 'Blood Pressure', icon: '🫀' },
  steps: { label: 'Steps', icon: '👣' },
  water: { label: 'Water', icon: '💧' },
  mood: { label: 'Mood', icon: '😊' },
};

const MOOD_LABEL: Record<string, { emoji: string; label: string }> = {
  great: { emoji: '😊', label: 'Feeling great' },
  okay: { emoji: '😐', label: 'Okay' },
  unwell: { emoji: '😢', label: 'Not well' },
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  hospital: { label: 'Hospital', icon: '🏥' },
  date: { label: 'Important date', icon: '📅' },
  todo: { label: 'To-do', icon: '📝' },
  note: { label: 'Note', icon: '💭' },
};

function parseBP(value: string): { sys: number; dia: number } | null {
  const m = String(value).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!m) return null;
  return { sys: parseInt(m[1], 10), dia: parseInt(m[2], 10) };
}

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function FamilyHealthPage() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [trends, setTrends] = useState<{
    sugar: { value: number; time?: string }[];
    bp: BpPoint[];
    steps: { value: number; time?: string }[];
  }>({ sugar: [], bp: [], steps: [] });

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health-checkins');
      if (!res.ok) return;
      const data = await res.json();
      const list: Checkin[] = Array.isArray(data) ? data : [];
      setCheckins(list);
      const cutoff = Date.now() - 7 * 86400000;
      const recent = list.filter((c) => c.created_at && new Date(c.created_at).getTime() >= cutoff);
      const byTime = (a: Checkin, b: Checkin) =>
        new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime();
      const sugar = recent
        .filter((c) => c.metric === 'sugar')
        .sort(byTime)
        .map((c) => ({ value: parseFloat(c.value), time: c.created_at }))
        .filter((p) => !isNaN(p.value));
      const bp: BpPoint[] = recent
        .filter((c) => c.metric === 'bp')
        .sort(byTime)
        .map((c): BpPoint | null => {
          const p = parseBP(c.value);
          return p ? { ...p, time: c.created_at } : null;
        })
        .filter((p): p is BpPoint => p !== null);
      const steps = recent
        .filter((c) => c.metric === 'steps')
        .sort(byTime)
        .map((c) => ({ value: parseFloat(c.value), time: c.created_at }))
        .filter((p) => !isNaN(p.value));
      setTrends({ sugar, bp, steps });
    } catch {
      // keep last known state on transient errors
    }
  }, []);

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/memories');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMemories(data);
    } catch {
      // keep last known state
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHealth();
    loadMemories();
    const id = setInterval(() => {
      loadHealth();
      loadMemories();
    }, 2500);
    return () => clearInterval(id);
  }, [loadHealth, loadMemories]);

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
      setMemories((m) => m.filter((x) => x.id !== id));
    } catch {}
  };

  const flagged = checkins.filter((c) => c.flagged);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Health</h2>
        <p className="text-sm text-ink-muted">
          Live readings from grandma&apos;s device — sugar, blood pressure, steps and mood.
        </p>
      </div>

      {/* Abnormal readings */}
      {flagged.length > 0 && (
        <div className="rounded-3xl border border-terra/35 bg-terra-soft p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            <h3 className="text-sm font-bold text-terra">Readings need attention</h3>
            <span className="ml-auto rounded-full bg-terra/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-terra">
              {flagged.length} flagged
            </span>
          </div>
          <div className="space-y-2">
            {flagged.slice(0, 5).map((c) => {
              const meta = CHECKIN_META[c.metric] || { label: c.metric, icon: '📋' };
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-base">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink">{meta.label}</p>
                    {c.note && (
                      <p className="truncate text-[11px] text-ink-muted">
                        {c.note.length > 60 ? `${c.note.slice(0, 57)}…` : c.note}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-extrabold text-terra">
                    {c.value}{c.unit ? ` ${c.unit}` : ''}
                  </span>
                  <span className="min-w-10 text-right text-[11px] text-ink-muted">{fmtTime(c.created_at)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Latest readings */}
      <div className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🩺</span>
          <h3 className="text-sm font-bold text-ink">Latest readings</h3>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-sage">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sage" /> Live
          </span>
        </div>
        {checkins.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No readings yet — grandma can say her sugar, blood pressure or steps to the AI Companion.
          </p>
        ) : (
          <div className="space-y-2">
            {Object.values(
              checkins.reduce<Record<string, Checkin>>((acc, c) => {
                if (!acc[c.metric]) acc[c.metric] = c;
                return acc;
              }, {})
            ).map((c) => {
              const meta = CHECKIN_META[c.metric] || { label: c.metric, icon: '📋' };
              const mood = c.metric === 'mood' ? MOOD_LABEL[c.value] : undefined;
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-base">{mood ? mood.emoji : meta.icon}</span>
                  <p className="flex-1 text-xs font-bold text-ink">{meta.label}</p>
                  <span className={`text-sm font-bold ${c.flagged ? 'text-terra' : 'text-ink'}`}>
                    {c.flagged ? '⚠ ' : ''}
                    {mood ? mood.label : `${c.value}${c.unit ? ` ${c.unit}` : ''}`}
                  </span>
                  <span className="min-w-10 text-right text-[11px] text-ink-muted">{fmtTime(c.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7-day trends */}
      <div className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">📈</span>
          <h3 className="text-sm font-bold text-ink">7-day trends</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink-muted">Sugar (mg/dL)</p>
            <LineChart data={trends.sugar} color="#C1502E" unit="mg/dL" emptyLabel="No sugar readings yet" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink-muted">Blood pressure</p>
            <BpChart data={trends.bp} emptyLabel="No BP readings yet" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-ink-muted">Steps</p>
            <LineChart data={trends.steps} color="#E7A33E" unit="steps" emptyLabel="No step readings yet" />
          </div>
        </div>
      </div>

      {/* Grandma's memory */}
      <div className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h3 className="text-sm font-bold text-ink">Grandma&apos;s Memory</h3>
        </div>
        {memories.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing saved yet — grandma can ask the AI Companion to remember dates, appointments or to-dos.
          </p>
        ) : (
          <div className="space-y-2">
            {memories.slice(0, 6).map((m) => {
              const meta = CATEGORY_META[m.category || 'note'] || CATEGORY_META.note;
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="text-base">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-ink">{meta.label}</p>
                    <p className="text-sm text-ink">{m.translated_text || m.content}</p>
                  </div>
                  <button
                    onClick={() => deleteMemory(m.id)}
                    title="Delete"
                    className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
