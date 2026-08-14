'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun, KeyRound, Languages, UserRound } from 'lucide-react';
import { LANGS, nativeName } from '../../../lib/langs';

type LinkedGrandparent = { id: string; name: string; language?: string | null };
type Member = { name: string; relation?: string; email?: string | null };

export default function FamilySettingsPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [grandparents, setGrandparents] = useState<LinkedGrandparent[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [replyLang, setReplyLang] = useState('ta-IN');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try {
      const saved = localStorage.getItem('bridge-family-reply-lang');
      if (saved) setReplyLang(saved);
    } catch {}
    fetch('/api/auth/me')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: { member?: Member; linkedGrandparents?: LinkedGrandparent[] } | null) => {
        if (!d) return;
        if (d.member) setMember(d.member);
        const gps = Array.isArray(d.linkedGrandparents) ? d.linkedGrandparents : [];
        setGrandparents(gps);
        setReplyLang((cur) => (cur === 'ta-IN' && gps[0]?.language ? gps[0].language : cur));
      })
      .catch(() => {});
  }, []);

  const toggleTheme = (next: 'light' | 'dark') => {
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('bridge-theme', next);
    } catch {}
  };

  const section = 'rounded-3xl border border-line bg-card p-4 shadow-soft';
  const sectionTitle = 'mb-3 flex items-center gap-2 text-sm font-bold text-ink';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Settings</h2>
        <p className="text-sm text-ink-muted">Family dashboard — appearance, language and connections.</p>
      </div>

      {/* Your account */}
      <section className={section}>
        <p className={sectionTitle}>
          <UserRound size={17} className="text-brand" /> Your account
        </p>
        <div className="flex items-center gap-3 rounded-2xl bg-card-soft px-4 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand">
            {(member?.name || 'F')[0]}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{member?.name || 'Family member'}</p>
            <p className="text-xs text-ink-muted">
              {member?.relation || 'Family'}
              {member?.email ? ` · ${member.email}` : ''}
            </p>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className={section}>
        <p className={sectionTitle}>
          <Moon size={17} className="text-brand" /> Appearance
        </p>
        <div className="flex gap-1 rounded-full bg-card-soft p-1">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleTheme(t)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors ${
                theme === t ? 'bg-brand text-white' : 'text-ink-muted'
              }`}
            >
              {t === 'light' ? <Sun size={15} /> : <Moon size={15} />}
              {t}
            </button>
          ))}
        </div>
      </section>

      {/* Reply language — the language family replies are translated into for
          grandma to hear. This is a family-side choice; grandma's own app
          settings are untouched. */}
      <section className={section}>
        <p className={sectionTitle}>
          <Languages size={17} className="text-brand" /> Reply language
        </p>
        <p className="mb-3 text-xs text-ink-muted">
          Your replies are translated into this language before grandma hears them.
        </p>
        <select
          value={replyLang}
          onChange={(e) => {
            setReplyLang(e.target.value);
            try {
              localStorage.setItem('bridge-family-reply-lang', e.target.value);
            } catch {}
          }}
          className="w-full rounded-2xl border border-line bg-card-soft px-4 py-3 text-sm font-semibold text-ink outline-none"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      </section>

      {/* Linked grandparents — read-only in the demo (no login to manage links) */}
      <section className={section}>
        <p className={sectionTitle}>
          <KeyRound size={17} className="text-brand" /> Linked grandparents
        </p>
        {grandparents.length === 0 ? (
          <p className="mb-3 text-xs text-ink-muted">No grandparents linked yet.</p>
        ) : (
          <div className="space-y-2">
            {grandparents.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-card-soft px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {g.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{g.name}</p>
                  <p className="text-xs text-ink-muted">
                    {g.language ? nativeName(g.language) : 'Language not set'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
