'use client';
import { useEffect, useRef, useState } from 'react';
import { Siren, Phone, User, PhoneCall, CheckCircle2 } from 'lucide-react';
import { T, translate, fmt, useLang } from '../../lib/i18n';
import { grandmaLangCode, grandmaVoice } from '../../lib/langs';
import { playSpeech, stopSpeech } from '../../lib/audio';

const CONTACTS = [
  { name: 'Arun', relation: 'rel.son', phone: '+91 98765 43210' },
  { name: 'Priya', relation: 'rel.daughter', phone: '+91 91234 56780' },
  { name: 'Dr. Mehta', relation: 'rel.doctor', phone: '+91 90000 11122' },
];

// Seconds grandma gets to cancel after pressing SOS. The countdown is read
// aloud, so this has to be longer than it takes to say the line — the slower
// hand-picked voices take a while to read it, hence 10s.
const COUNTDOWN_SECONDS = 10;

export default function EmergencyPage() {
  const lang = useLang();
  const [phase, setPhase] = useState<'idle' | 'counting' | 'sent'>('idle');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const locationRef = useRef<string | null>(null);
  const speakingRef = useRef(false);
  // `queuedRef` holds a line that arrived while another was still speaking.
  const queuedRef = useRef<{ text: string; cached?: string | null } | null>(null);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Stop the countdown (and any spoken announcements) if the user leaves
  // mid-SOS — and re-arm the guardian, which we'd stood down.
  useEffect(() => () => {
    cleanup();
    stopSpeech();
    window.speechSynthesis?.cancel(); // stop any browser-TTS fallback too
  }, []);

  // Free, on-device fallback via the Web Speech API. Only used when Sarvam
  // TTS fails, with one hard rule so it can never degrade into noise: it only
  // speaks if a voice actually exists for grandma's language — otherwise it
  // stays silent (the countdown UI and family alert still work fine). An
  // English voice reading Tamil is worse than no voice at all.
  // `finish` is one-shot and watchdogged so a Chrome quirk where speak() never
  // fires onend/onerror can't stall the queue forever.
  const speakWithBrowser = (text: string, done: () => void) => {
    const synth = window.speechSynthesis;
    if (!synth) {
      done();
      return;
    }
    const target = grandmaLangCode();
    const exact = target.toLowerCase();
    const primary = target.split('-')[0].toLowerCase();
    const pickVoice = () =>
      synth.getVoices().find((v) => v.lang.toLowerCase() === exact) ||
      synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(primary)) ||
      null;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };

    const speakNow = (voice: SpeechSynthesisVoice | null) => {
      if (!voice) {
        // No voice for this language — a silent countdown beats garbled speech.
        console.warn('[SOS] no browser voice for ' + target + ' — staying silent');
        finish();
        return;
      }
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = target;
        utter.voice = voice;
        utter.rate = 0.95;
        // Watchdog: if the browser never fires onend/onerror (a known Chrome
        // quirk with unloaded voices / backgrounded tabs), release the queue.
        window.setTimeout(finish, 15000);
        utter.onend = finish;
        utter.onerror = finish;
        synth.speak(utter);
      } catch {
        finish();
      }
    };

    const voice = pickVoice();
    if (voice) {
      speakNow(voice);
      return;
    }
    if (synth.getVoices().length === 0) {
      // Chrome loads voices asynchronously — getVoices() is empty at first.
      // Wait for the voiceschanged event once before giving up.
      const onVoices = () => {
        synth.removeEventListener('voiceschanged', onVoices);
        speakNow(pickVoice());
      };
      synth.addEventListener('voiceschanged', onVoices);
      window.setTimeout(() => {
        synth.removeEventListener('voiceschanged', onVoices);
        speakNow(pickVoice());
      }, 3000);
      return;
    }
    speakNow(null); // voices loaded, but none match the language — stay silent
  };

  // Announce a line aloud in grandma's language (one at a time). If a line is
  // already playing the new one is queued, so the "alert sent" confirmation
  // is never silently dropped behind the countdown announcement.
  const speak = async (text: string, cached?: string | null) => {
    if (speakingRef.current) {
      queuedRef.current = { text, cached };
      return;
    }
    speakingRef.current = true;
    // One-shot: playSpeech already guards its own callback, but the browser
    // fallback can theoretically fire onend AND onerror — a second call would
    // wrongly reset speakingRef mid-playback and replay the queue.
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      speakingRef.current = false;
      const next = queuedRef.current;
      queuedRef.current = null;
      if (next) speak(next.text, next.cached);
    };
    try {
      let audio: string;
      if (cached) {
        audio = cached;
      } else {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, target_language_code: grandmaLangCode(), speaker: grandmaVoice() }),
        });
        const data = await res.json();
        if (!res.ok || !data.audio) throw new Error('TTS failed');
        audio = data.audio;
      }
      playSpeech(audio, done);
    } catch {
      // Sarvam TTS down (e.g. credits exhausted) — fall back to the browser's
      // built-in speech synthesis instead of staying silent.
      speakWithBrowser(text, done);
    }
  };

  // Best-effort location share: attached to the alert as a Google Maps link.
  const grabLocation = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locationRef.current = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      },
      () => {},
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  // Capture the location as soon as the page opens so it is ready when SOS is
  // pressed. (Voice lines are generated on demand — no API calls on load.)
  useEffect(() => {
    grabLocation();
  }, [lang]);

  const trigger = () => {
    if (phase !== 'idle') return;
    setError('');
    setPhase('counting');
    setCountdown(COUNTDOWN_SECONDS);
    grabLocation();
    speak(fmt(lang, 'emergency.voiceCountdown', { n: COUNTDOWN_SECONDS }));
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          cleanup();
          sendAlert();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendAlert = async () => {
    try {
      const res = await fetch('/api/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: 'Kamala',
          message: 'Emergency! I need help.',
          location: locationRef.current,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setPhase('sent');
      speak(translate(lang, 'emergency.voiceSent'));
    } catch {
      setPhase('idle');
      setError(translate(lang, 'emergency.alertError'));
    }
  };

  const allClear = async () => {
    try {
      await fetch('/api/emergency', { method: 'DELETE' });
    } catch {
      // best-effort; UI resets regardless
    }
    setPhase('idle');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="emergency.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="emergency.subtitle" /></p>
      </div>

      {/* SOS */}
      <section className="flex flex-col items-center rounded-3xl border border-line bg-card p-8 shadow-soft">
        {phase === 'idle' && (
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
        )}

        {phase === 'counting' && (
          <div className="text-center">
            <button
              onClick={() => {
                cleanup();
                queuedRef.current = null; // don't speak anything still queued
                stopSpeech(); // cut the countdown announcement
                window.speechSynthesis?.cancel(); // and any browser-TTS fallback
                setCountdown(COUNTDOWN_SECONDS);
                setPhase('idle');
              }}
              className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-terra-soft text-terra transition-transform hover:scale-105 active:scale-95"
              aria-label={translate(lang, 'emergency.cancel')}
            >
              <span className="text-5xl font-bold">{countdown}</span>
            </button>
            <p className="mt-6 text-base font-bold text-ink">
              <T k="emergency.calling" />
            </p>
            <p className="text-xs font-semibold text-terra">{translate(lang, 'emergency.cancel')}</p>
          </div>
        )}

        {phase === 'sent' && (
          <div className="text-center">
            <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-sage-soft text-sage">
              <CheckCircle2 size={64} />
            </div>
            <p className="mt-6 text-lg font-bold text-ink"><T k="emergency.sent" /></p>
            <p className="text-xs text-ink-muted">{translate(lang, 'emergency.notified')}</p>
            <button
              onClick={allClear}
              className="mt-5 rounded-full border border-line px-6 py-2 text-sm font-semibold text-ink transition-colors hover:bg-card-soft"
            >
              <T k="emergency.allClear" />
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-2xl bg-terra-soft px-4 py-2 text-xs font-semibold text-terra">{error}</p>
        )}
      </section>

      {/* Contacts */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="emergency.contacts" /></h2>
        <div className="space-y-3">
          {CONTACTS.map((c) => (
            <a
              key={c.name}
              href={`tel:${c.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 shadow-soft transition-colors hover:bg-card-soft"
            >
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                <User size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{c.name}</p>
                <p className="text-xs text-ink-muted">{translate(lang, c.relation)} · {c.phone}</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-terra-soft px-4 py-2 text-xs font-bold text-terra">
                <PhoneCall size={14} /> {translate(lang, 'emergency.call')}
              </span>
            </a>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-center text-xs text-ink-muted">
          <Phone size={12} /> {translate(lang, 'emergency.uiOnly')}
        </p>
      </section>
    </div>
  );
}
