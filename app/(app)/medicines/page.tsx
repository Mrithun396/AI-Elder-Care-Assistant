'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Pill,
  Clock,
  CheckCircle2,
  CalendarClock,
  Volume2,
  BellRing,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
} from 'lucide-react';
import { T, fmt, translate, useLang } from '../../lib/i18n';
import { grandmaLangCode, grandmaVoice } from '../../lib/langs';
import { playSpeech, stopSpeech } from '../../lib/audio';

type Med = { id: string; name: string; dose: string; time: string };

// Same four medicines the seeded Supabase rows use (24h 'HH:MM' times). Kept as
// a local fallback so the page still works when Supabase isn't configured.
const DEFAULT_MEDS: Med[] = [
  { id: 'default-metformin', name: 'Metformin', dose: '500 mg', time: '08:00' },
  { id: 'default-telmisartan', name: 'Telmisartan', dose: '40 mg', time: '08:00' },
  { id: 'default-vitamind3', name: 'Vitamin D3', dose: '1,000 IU', time: '13:00' },
  { id: 'default-aspirin', name: 'Aspirin', dose: '75 mg', time: '21:00' },
];

const PALETTE = [
  'bg-sage-soft text-sage',
  'bg-brand-soft text-brand',
  'bg-accent-soft text-accent',
  'bg-terra-soft text-terra',
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// '08:00' -> today's Date
function todayAt(time: string): Date {
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return new Date(8640000000000000);
  const d = new Date();
  d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
  return d;
}

// '08:00' -> '8:00 AM' for display
function fmtTime12(time: string): string {
  const m = String(time).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return time;
  let h = parseInt(m[1], 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${suffix}`;
}

function fmtCountdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h}:${pad(m)}:${pad(sec)}`;
}

export default function MedicinesPage() {
  const lang = useLang();
  const [meds, setMeds] = useState<Med[]>(DEFAULT_MEDS);
  const [medsLoaded, setMedsLoaded] = useState(false);
  // Persisted per-day, keyed by medicine id: { "abc": true } — resets daily
  const dayKey = () => new Date().toDateString();
  const [todayKey, setTodayKey] = useState('');
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  // null until mount so the server and client render identical HTML (no hydration mismatch)
  const [now, setNow] = useState<Date | null>(null);
  const [reminderText, setReminderText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', dose: '', time: '08:00' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Med>({ id: '', name: '', dose: '', time: '' });
  const [saveError, setSaveError] = useState('');
  const announcedRef = useRef<Set<string>>(new Set());
  const speakingRef = useRef(false);

  // Load medicines from Supabase once (fall back to the defaults silently).
  useEffect(() => {
    // Deferred a tick so the localStorage/state sync doesn't cascade inside the effect.
    const id = setTimeout(() => {
      const k = dayKey();
      setTodayKey(k);
      try {
        const raw = localStorage.getItem(`bridge-meds-${k}`);
        setTaken(raw ? JSON.parse(raw) : {});
      } catch {
        setTaken({});
      }
    }, 0);
    fetch('/api/medicines')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setMeds(data);
      })
      .catch(() => {})
      .finally(() => setMedsLoaded(true));
    return () => clearTimeout(id);
  }, []);

  // 1s tick for the countdown + reminder check
  useEffect(() => {
    const id = setTimeout(() => setNow(new Date()), 0);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(id);
      clearInterval(tick);
    };
  }, []);

  const persistTaken = (next: Record<string, boolean>) => {
    try {
      localStorage.setItem(`bridge-meds-${todayKey || dayKey()}`, JSON.stringify(next));
    } catch {}
  };

  const toggle = (id: string) => {
    setTaken((t) => {
      const next = { ...t, [id]: !t[id] };
      persistTaken(next);
      return next;
    });
  };

  const speak = async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: grandmaLangCode(), speaker: grandmaVoice() }),
      });
      const data = await res.json();
      if (!res.ok || !data.audio) throw new Error('TTS failed');
      playSpeech(data.audio, () => {
        speakingRef.current = false;
        setReminderText('');
      });
    } catch {
      speakingRef.current = false;
    }
  };

  const addMed = async () => {
    const name = addForm.name.trim();
    if (!name || !addForm.time) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, dose: addForm.dose.trim() || null, time: addForm.time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      setMeds((m) => [...m, data].sort((a, b) => a.time.localeCompare(b.time)));
      setAddForm({ name: '', dose: '', time: '08:00' });
      setAdding(false);
    } catch {
      setSaveError(translate(lang, 'comp.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (m: Med) => {
    setEditingId(m.id);
    setEditForm(m);
  };

  const saveEdit = async () => {
    const name = editForm.name.trim();
    if (!name || !editForm.time) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/medicines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editForm.id, name, dose: editForm.dose, time: editForm.time }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      setMeds((m) => m.map((x) => (x.id === data.id ? data : x)).sort((a, b) => a.time.localeCompare(b.time)));
      setEditingId(null);
    } catch {
      setSaveError(translate(lang, 'comp.errSave'));
    } finally {
      setSaving(false);
    }
  };

  const deleteMed = async (id: string, name: string) => {
    if (!window.confirm(`${translate(lang, 'med.deleteConfirm')} (${name})`)) return;
    try {
      await fetch(`/api/medicines?id=${id}`, { method: 'DELETE' });
      setMeds((m) => m.filter((x) => x.id !== id));
      setTaken((t) => {
        const next = { ...t };
        delete next[id];
        persistTaken(next);
        return next;
      });
    } catch {
      setSaveError(translate(lang, 'comp.errSave'));
    }
  };

  const pending = meds.filter((m) => !taken[m.id]);
  // Next dose = soonest not-yet-passed time among pending meds
  let nextDose: Med | null = null;
  let nextAt: Date | null = null;
  if (now) {
    for (const m of pending) {
      const t = todayAt(m.time);
      if (t.getTime() > now.getTime() && (!nextAt || t < nextAt)) {
        nextAt = t;
        nextDose = m;
      }
    }
  }

  // Spoken reminder: when pending meds' times have just arrived, read them aloud once.
  // Meds sharing a time (e.g. both 8:00 AM) are combined into one announcement so
  // the banner text always matches the audio.
  useEffect(() => {
    if (!now) return;
    const due = meds.filter((m) => {
      if (taken[m.id]) return false;
      const t = todayAt(m.time);
      const diff = now.getTime() - t.getTime();
      return diff >= 0 && diff < 1000 * 60 && !announcedRef.current.has(m.id);
    });
    if (due.length === 0) return;
    due.forEach((m) => announcedRef.current.add(m.id));
    const text =
      due.length === 1
        ? fmt(lang, 'med.reminder', { name: due[0].name })
        : fmt(lang, 'med.reminderPlural', { names: due.map((m) => m.name).join(', ') });
    setReminderText(text);
    speak(text);
  }, [now, taken, lang, meds]);

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink"><T k="med.title" /></h1>
          <p className="text-sm text-ink-muted">
            {fmt(lang, 'med.remaining', {
              remaining: pending.length,
              taken: meds.length - pending.length,
            })}
          </p>
        </div>
        {now && nextDose && nextAt ? (
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-3xl border border-line bg-card px-5 py-3 shadow-soft">
            <BellRing size={18} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                <T k="med.nextDose" />
              </p>
              <p className="text-lg font-bold tabular-nums text-ink">{fmtCountdown(nextAt.getTime() - now.getTime())}</p>
            </div>
            <p className="min-w-0 break-words text-sm font-semibold text-ink">{nextDose.name} · {fmtTime12(nextDose.time)}</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-3xl border border-line bg-sage-soft px-5 py-3 text-sm font-bold text-sage">
            <CheckCircle2 size={16} /> <T k="med.allDone" />
          </div>
        )}
      </div>

      {reminderText && (
        <button
          onClick={() => speak(reminderText)}
          className="flex w-full items-center gap-3 rounded-3xl bg-gradient-to-r from-accent to-brand px-5 py-4 text-left text-white shadow-soft transition-transform hover:scale-[1.01]"
        >
          <Volume2 size={22} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-white/70"><T k="med.spokenReminder" /></p>
            <p className="text-base font-bold">{reminderText}</p>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold"><T k="med.tapToHear" /></span>
        </button>
      )}

      {saveError && (
        <p className="rounded-2xl bg-terra-soft px-4 py-2 text-xs font-semibold text-terra">{saveError}</p>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.today" /></h2>
          <button
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95"
          >
            <Plus size={14} /> <T k="med.addMed" />
          </button>
        </div>

        {adding && (
          <div className="mb-4 rounded-3xl border border-brand/30 bg-brand-soft/40 p-4 shadow-soft">
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-muted"><T k="med.medName" /></span>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Metformin"
                  className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-muted"><T k="med.dose" /></span>
                <input
                  value={addForm.dose}
                  onChange={(e) => setAddForm((f) => ({ ...f, dose: e.target.value }))}
                  placeholder="e.g. 500 mg"
                  className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-ink-muted"><T k="med.time" /></span>
                <input
                  type="time"
                  value={addForm.time}
                  onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={addMed}
                disabled={saving || !addForm.name.trim() || !addForm.time}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
              >
                <Save size={14} /> {saving ? translate(lang, 'comp.thinking') : translate(lang, 'med.save')}
              </button>
              <button
                onClick={() => setAdding(false)}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-card-soft"
              >
                <X size={14} /> <T k="med.cancel" />
              </button>
            </div>
          </div>
        )}

        {meds.length === 0 && medsLoaded ? (
          <p className="rounded-3xl border border-dashed border-line bg-card p-6 text-center text-xs text-ink-muted">
            <T k="med.noneYet" />
          </p>
        ) : (
          <div className="space-y-3">
            {meds.map((m) => {
              const isTaken = !!taken[m.id];
              const isTime = !!now && todayAt(m.time).getTime() <= now.getTime();
              const editing = editingId === m.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-3xl border border-line bg-card p-4 shadow-soft transition-all ${
                    isTaken ? 'opacity-60' : ''
                  }`}
                >
                  {editing ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <input
                        value={editForm.dose}
                        onChange={(e) => setEditForm((f) => ({ ...f, dose: e.target.value }))}
                        className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <input
                        type="time"
                        value={editForm.time}
                        onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                        className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand"
                      />
                      <div className="flex items-center gap-2 sm:col-span-3">
                        <button
                          onClick={saveEdit}
                          disabled={saving || !editForm.name.trim() || !editForm.time}
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
                        >
                          <Save size={13} /> <T k="med.save" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-card-soft"
                        >
                          <X size={13} /> <T k="med.cancel" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${colorFor(m.name)}`}>
                        <Pill size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{m.name}</p>
                        <p className="text-xs text-ink-muted">
                          {m.dose} · {fmtTime12(m.time)}
                          {isTime && !isTaken ? ' · now' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => speak(fmt(lang, 'med.reminder', { name: m.name }))}
                        aria-label={translate(lang, 'med.tapToHear')}
                        className="mr-1 hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
                      >
                        <Volume2 size={15} />
                      </button>
                      <button
                        onClick={() => startEdit(m)}
                        aria-label={translate(lang, 'med.edit')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteMed(m.id, m.name)}
                        aria-label={translate(lang, 'med.delete')}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-terra transition-colors hover:bg-terra-soft"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => toggle(m.id)}
                        aria-pressed={isTaken}
                        className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          isTaken ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent hover:bg-accent hover:text-white'
                        }`}
                      >
                        {isTaken ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                        {isTaken ? translate(lang, 'med.taken') : translate(lang, 'med.pending')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
          <BellRing size={12} /> {translate(lang, 'med.remindersNote')}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.upcoming" /></h2>
        <div className="space-y-3">
          {pending.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-card p-6 text-center text-xs text-ink-muted">
              <T k="med.noneYet" />
            </p>
          ) : (
            pending.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-3xl border border-line bg-card-soft p-4">
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colorFor(m.name)}`}>
                  <CalendarClock size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{m.name} · {m.dose}</p>
                  <p className="text-xs text-ink-muted">{fmt(lang, 'med.reminder', { name: m.name })}</p>
                </div>
                <p className="text-sm font-bold text-accent">{fmtTime12(m.time)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="med.completed" /></h2>
        <div className="space-y-3">
          {meds.filter((m) => taken[m.id]).length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line bg-card p-6 text-center text-xs text-ink-muted">
              <T k="med.noneYet" />
            </p>
          ) : (
            meds
              .filter((m) => taken[m.id])
              .map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 opacity-70">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft text-sage">
                    <CheckCircle2 size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink line-through decoration-ink-muted/50">{m.name} · {m.dose}</p>
                    <p className="text-xs text-ink-muted">{fmtTime12(m.time)}</p>
                  </div>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
}
