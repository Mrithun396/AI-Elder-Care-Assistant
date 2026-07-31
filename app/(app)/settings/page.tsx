'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Languages, Volume2, Users, Moon, Info, ChevronRight, HeartHandshake } from 'lucide-react';
import { LANGS, codeForLang } from '../../lib/langs';
import { T, translate, useLang } from '../../lib/i18n';

const LANG_NAMES = LANGS.map((l) => l.name);
const VOICES = ['Female — Priya (Tamil)', 'Male — Arun (Hindi)', 'Female — Anjali (English)'];

type FamilyMember = { id: string; name: string; relation: string };

export default function SettingsPage() {
  const uiLang = useLang();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState('Tamil');
  const [voice, setVoice] = useState(VOICES[0]);
  const [family, setFamily] = useState<FamilyMember[]>([]);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try {
      const saved = localStorage.getItem('bridge-lang');
      if (saved) {
        const name = LANGS.find((l) => l.code === saved)?.name;
        if (name) setLang(name);
      }
    } catch {}
    fetch('/api/family-members')
      .then((r) => r.json())
      .then((d: FamilyMember[]) => setFamily(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

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

      {/* Voice */}
      <section className="rounded-3xl border border-line bg-card p-4 shadow-soft">
        <p className="mb-3 flex items-center gap-3 text-sm font-semibold text-ink">
          <Volume2 size={18} className="text-accent" /> <T k="settings.voice" />
        </p>
        <div className="space-y-2">
          {VOICES.map((v) => (
            <button
              key={v}
              onClick={() => setVoice(v)}
              className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm transition-colors ${
                voice === v ? 'bg-brand-soft text-brand font-semibold' : 'bg-card-soft text-ink hover:bg-brand-soft'
              }`}
            >
              {v}
              {voice === v && <span className="h-2 w-2 rounded-full bg-brand" />}
            </button>
          ))}
        </div>
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
