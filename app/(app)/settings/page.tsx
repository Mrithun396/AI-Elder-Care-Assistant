'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Languages, Volume2, Users, Moon, Info, ChevronRight, HeartHandshake, Play, Square } from 'lucide-react';
import { LANGS, VOICES, codeForLang, grandmaLangCode, voiceLabel } from '../../lib/langs';
import { T, translate, useLang } from '../../lib/i18n';
import { playSpeech, stopSpeech } from '../../lib/audio';

const LANG_NAMES = LANGS.map((l) => l.name);

type FamilyMember = { id: string; name: string; relation: string };

export default function SettingsPage() {
  const uiLang = useLang();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState('Tamil');
  const [voice, setVoice] = useState('ishita');
  const [family, setFamily] = useState<FamilyMember[]>([]);
  // Which voice is currently being previewed (its id, or null).
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  // Guards a stale preview: if the user stops (or switches) while a /api/tts
  // request is still in flight, the resolved audio must not play.
  const previewSeqRef = useRef(0);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try {
      const saved = localStorage.getItem('bridge-lang');
      if (saved) {
        const name = LANGS.find((l) => l.code === saved)?.name;
        if (name) setLang(name);
      }
      const v = localStorage.getItem('bridge-voice');
      if (v && VOICES.includes(v)) setVoice(v);
    } catch {}
    fetch('/api/family-members')
      .then((r) => r.json())
      .then((d: FamilyMember[]) => setFamily(Array.isArray(d) ? d : []))
      .catch(() => {});
    return () => stopSpeech();
  }, []);

  // Preview a voice: speak a short, localized sample line through it. Tapping
  // the same voice stops it; tapping a different voice switches directly.
  const previewVoice = async (v: string) => {
    if (previewing) {
      // Stop whatever is playing; if it's a different voice, start the new one.
      stopSpeech();
      setPreviewing(null);
      previewSeqRef.current++; // invalidate any in-flight preview
      if (previewing === v) return;
    }
    setPreviewErr('');
    setPreviewing(v);
    const mySeq = ++previewSeqRef.current;
    try {
      const sample = translate(uiLang, 'greeting.morning');
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sample, target_language_code: grandmaLangCode(), speaker: v }),
      });
      const data = await res.json();
      if (mySeq !== previewSeqRef.current) return; // superseded — don't play
      if (!res.ok || !data.audio) throw new Error(data.error || 'TTS failed');
      playSpeech(data.audio, () => {
        if (previewSeqRef.current === mySeq) setPreviewing((cur) => (cur === v ? null : cur));
      });
    } catch {
      if (mySeq !== previewSeqRef.current) return;
      setPreviewing(null);
      setPreviewErr(translate(uiLang, 'messages.ttsError'));
    }
  };

  const toggleTheme = (next: 'light' | 'dark') => {
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('bridge-theme', next);
    } catch {}
  };

  const row =
    'flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-card-soft';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="settings.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="settings.subtitle" /></p>
      </div>

      {/* Language */}
      <section className="rounded-3xl border border-line bg-card p-2 shadow-soft">
        <div className={`${row} border-b border-line rounded-none`}>
          <span className="flex items-center gap-3"><Languages size={18} className="text-brand" /> <T k="settings.language" /></span>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          {LANG_NAMES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLang(l);
                try {
                  localStorage.setItem('bridge-lang', codeForLang(l));
                } catch {}
                window.dispatchEvent(new Event('bridge-lang'));
              }}
              className={`rounded-2xl px-2 py-2.5 text-sm font-semibold transition-colors ${
                lang === l ? 'bg-brand text-white' : 'bg-card-soft text-ink hover:bg-brand-soft'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </section>

      {/* Voice — 37 real Sarvam voices. A voice is not tied to a language, so
          the list shows plain names (no language tags) and every voice speaks
          grandma's selected language. */}
      <section className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-3 text-sm font-semibold text-ink">
            <Volume2 size={18} className="text-accent" /> <T k="settings.voice" />
          </p>
          <span className="rounded-full bg-card-soft px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
            {VOICES.length} voices
          </span>
        </div>
        <p className="mb-3 text-xs text-ink-muted">{translate(uiLang, 'settings.voiceHint')}</p>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {VOICES.map((v) => (
            <div
              key={v}
              className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm transition-colors ${
                voice === v ? 'bg-brand-soft text-brand font-semibold' : 'bg-card-soft text-ink hover:bg-brand-soft'
              }`}
            >
              <button
                onClick={() => previewVoice(v)}
                aria-label={`${translate(uiLang, 'settings.voicePreview')}: ${voiceLabel(v)}`}
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                  previewing === v ? 'bg-terra text-white' : 'bg-white/70 text-brand hover:bg-brand hover:text-white'
                }`}
              >
                {previewing === v ? <Square size={13} /> : <Play size={13} className="ml-0.5" />}
              </button>
              <button
                onClick={() => {
                  setVoice(v);
                  try {
                    localStorage.setItem('bridge-voice', v);
                  } catch {}
                }}
                className="flex-1 text-left capitalize"
              >
                {voiceLabel(v)}
              </button>
              {voice === v && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
            </div>
          ))}
        </div>
        {previewErr && (
          <p className="mt-2 rounded-xl bg-terra-soft px-3 py-1.5 text-[11px] font-semibold text-terra">{previewErr}</p>
        )}
      </section>

      {/* Family members */}
      <section className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <p className="mb-3 flex items-center gap-3 text-sm font-semibold text-ink">
          <Users size={18} className="text-sage" /> <T k="settings.family" />
        </p>
        <div className="space-y-2">
          {family.length === 0 ? (
            <p className="rounded-2xl bg-card-soft px-4 py-3 text-sm text-ink-muted">{translate(uiLang, 'settings.loadingFamily')}</p>
          ) : (
            family.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-card-soft px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {f.name[0]}
                </span>
                <p className="text-sm font-semibold text-ink">{f.name}</p>
                <span className="ml-auto rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  {f.relation}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Dark mode */}
      <section className="rounded-3xl border border-line bg-card p-2 shadow-soft">
        <div className={`${row} border-b border-line rounded-none`}>
          <span className="flex items-center gap-3"><Moon size={18} className="text-brand" /> <T k="settings.darkMode" /></span>
          <div className="flex gap-1 rounded-full bg-card-soft p-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => toggleTheme(t)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${
                  theme === t ? 'bg-brand text-white' : 'text-ink-muted'
                }`}
              >
                {translate(uiLang, t === 'light' ? 'settings.light' : 'settings.dark')}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <p className="mb-3 flex items-center gap-3 text-sm font-semibold text-ink">
          <Info size={18} className="text-accent" /> <T k="settings.about" />
        </p>
        <div className="space-y-2 text-sm text-ink-muted">
          <div className="flex items-center gap-2 rounded-2xl bg-card-soft px-4 py-3">
            <HeartHandshake size={16} className="text-brand" />
            <span><b className="text-ink">Bridge</b> — <T k="shell.tagline" /></span>
            <span className="ml-auto text-xs">v0.1.0</span>
          </div>
          <Link href="/family" className={`${row} bg-card-soft hover:bg-brand-soft`}>
            <T k="settings.openFamily" /> <ChevronRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  );
}
