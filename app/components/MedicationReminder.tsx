'use client';
import { useEffect, useRef, useState } from 'react';
import { BellRing, Volume2, X } from 'lucide-react';
import { T, fmt, translate, useLang } from '../lib/i18n';
import { grandmaLangCode, grandmaVoice } from '../lib/langs';
import { playSpeech, stopSpeech } from '../lib/audio';

type DueMed = { id: string; name: string; dose: string; time: string };

// Global medication reminder. Polls /api/reminders every 30s and — whenever a
// scheduled med becomes due — speaks it aloud and shows a sticky banner, on ANY
// screen (not just the Medicines page). Each med is announced once per day:
// "announced" ids persist in localStorage, and meds already marked taken are
// skipped entirely.
export default function MedicationReminder() {
  const lang = useLang();
  const [banner, setBanner] = useState<{ text: string; meds: DueMed[] } | null>(null);
  const announcedRef = useRef<Set<string>>(new Set());
  const speakingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The day the announced-set was loaded for — reseeded when it changes so a
  // session that stays open past midnight announces the new day's doses.
  const dayRef = useRef('');

  const dayKey = () => new Date().toDateString();

  const speak = async (text: string, onDone?: () => void) => {
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
        onDone?.();
      });
    } catch {
      speakingRef.current = false;
      onDone?.();
    }
  };

  const check = async () => {
    // Roll over to a new day: forget yesterday's announced ids so today's
    // doses are announced again.
    const today = dayKey();
    if (dayRef.current !== today) {
      dayRef.current = today;
      try {
        announcedRef.current = new Set(JSON.parse(localStorage.getItem(`bridge-rem-${today}`) || '[]'));
      } catch {
        announcedRef.current = new Set();
      }
    }
    try {
      const res = await fetch('/api/reminders');
      if (!res.ok) return;
      const data = await res.json();
      const due: DueMed[] = Array.isArray(data.due) ? data.due : [];
      if (due.length === 0) return;

      // Skip meds already marked taken today (bridge-meds-<day>) or announced.
      let taken: Record<string, boolean> = {};
      try {
        taken = JSON.parse(localStorage.getItem(`bridge-meds-${dayKey()}`) || '{}');
      } catch {}
      const fresh = due.filter((m) => !taken[m.id] && !announcedRef.current.has(m.id));
      if (fresh.length === 0) return;

      fresh.forEach((m) => announcedRef.current.add(m.id));
      try {
        localStorage.setItem(`bridge-rem-${dayKey()}`, JSON.stringify([...announcedRef.current]));
      } catch {}

      const text =
        fresh.length === 1
          ? fmt(lang, 'med.reminder', { name: fresh[0].name })
          : fmt(lang, 'med.reminderPlural', { names: fresh.map((m) => m.name).join(', ') });

      setBanner({ text, meds: fresh });
      speak(text);

      // Browser notification (lazily request permission on the first reminder)
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification('💊 ' + text);
          } catch {}
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }

      // Auto-dismiss the banner after 2 minutes
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBanner(null), 2 * 60 * 1000);
    } catch {
      // Supabase missing or any transient error — reminders stay silent.
    }
  };

  useEffect(() => {
    dayRef.current = dayKey();
    // Restore today's announced set so a reload doesn't re-announce meds.
    try {
      announcedRef.current = new Set(JSON.parse(localStorage.getItem(`bridge-rem-${dayRef.current}`) || '[]'));
    } catch {}
    check();
    const id = setInterval(check, 30000);
    return () => {
      clearInterval(id);
      if (timerRef.current) clearTimeout(timerRef.current);
      stopSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!banner) return null;

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-14 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 lg:top-6 lg:left-auto lg:right-6 lg:translate-x-0"
    >
      <div className="anim-fade-up flex items-center gap-3 rounded-3xl bg-gradient-to-r from-accent to-brand px-5 py-4 text-white shadow-soft">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <BellRing size={20} className="animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
            <T k="med.spokenReminder" />
          </p>
          <p className="text-sm font-bold leading-snug">{banner.text}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => speak(fmt(lang, banner.meds.length === 1 ? 'med.reminder' : 'med.reminderPlural', {
              name: banner.meds[0]?.name,
              names: banner.meds.map((m) => m.name).join(', '),
            }))}
            aria-label={translate(lang, 'med.remRepeat')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          >
            <Volume2 size={16} />
          </button>
          <button
            onClick={() => setBanner(null)}
            aria-label={translate(lang, 'med.remDismiss')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
