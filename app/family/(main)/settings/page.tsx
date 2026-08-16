'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun, KeyRound, Unlink, Languages, UserRound } from 'lucide-react';
import { LANGS, nativeName } from '../../../lib/langs';

type LinkedGrandparent = { id: string; name: string; language?: string | null };
type Member = { name: string; relation?: string; email?: string | null };

export default function FamilySettingsPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [grandparents, setGrandparents] = useState<LinkedGrandparent[]>([]);
  // Link requests sent but not yet confirmed by grandma.
  const [pendingGrandparents, setPendingGrandparents] = useState<LinkedGrandparent[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [replyLang, setReplyLang] = useState('ta-IN');
  const [linkCode, setLinkCode] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkDone, setLinkDone] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    try {
      const saved = localStorage.getItem('bridge-family-reply-lang');
      if (saved) setReplyLang(saved);
    } catch {}
    fetch('/api/auth/me')
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d: { member?: Member; linkedGrandparents?: LinkedGrandparent[]; pendingGrandparents?: LinkedGrandparent[] } | null) => {
        if (!d) return;
        if (d.member) setMember(d.member);
        const gps = Array.isArray(d.linkedGrandparents) ? d.linkedGrandparents : [];
        setGrandparents(gps);
        setPendingGrandparents(Array.isArray(d.pendingGrandparents) ? d.pendingGrandparents : []);
        setReplyLang((cur) => cur === 'ta-IN' && gps[0]?.language ? gps[0].language : cur);
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

  const linkToGrandparent = async () => {
    const code = linkCode.trim().toUpperCase();
    if (!code || linkBusy) return;
    setLinkBusy(true);
    setLinkError('');
    setLinkDone(false);
    try {
      const res = await fetch('/api/auth/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkCode: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not link — please try again.');
      setLinkCode('');
      if (data.status === 'pending') {
        setLinkDone(true);
        setLinkMessage(data.message || 'Request sent — waiting for grandma to confirm.');
        setTimeout(() => setLinkDone(false), 5000);
      } else {
        setLinkDone(true);
        setLinkMessage(data.message || 'Linked ✓');
        setTimeout(() => setLinkDone(false), 3000);
      }
      setGrandparents(Array.isArray(data.linkedGrandparents) ? data.linkedGrandparents : []);
      setPendingGrandparents(Array.isArray(data.pendingGrandparents) ? data.pendingGrandparents : []);
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Could not link — please try again.');
    } finally {
      setLinkBusy(false);
    }
  };

  const unlinkGrandparent = async (id: string) => {
    if (removing) return;
    setRemoving(id);
    try {
      const res = await fetch('/api/auth/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grandparentId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not remove the link.');
      setGrandparents(Array.isArray(data.linkedGrandparents) ? data.linkedGrandparents : []);
      setPendingGrandparents(Array.isArray(data.pendingGrandparents) ? data.pendingGrandparents : []);
    } catch (err: unknown) {
      setLinkError(err instanceof Error ? err.message : 'Could not remove the link.');
    } finally {
      setRemoving(null);
    }
  };

  const section = 'rounded-3xl border border-line bg-card p-4 shadow-soft';
  const sectionTitle = 'mb-3 flex items-center gap-2 text-sm font-bold text-ink';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Settings</h2>
        <p className="text-sm text-ink-muted">Your family account — appearance, language and connections.</p>
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

      {/* Linked grandparents */}
      <section className={section}>
        <p className={sectionTitle}>
          <KeyRound size={17} className="text-brand" /> Linked grandparents
        </p>
        {pendingGrandparents.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">Awaiting grandma&apos;s confirmation</p>
            {pendingGrandparents.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-terra/30 bg-terra-soft px-4 py-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-terra-soft text-sm font-bold text-terra">
                  {g.name[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{g.name}</p>
                  <p className="text-xs font-semibold text-terra">⏳ Waiting for {g.name} to confirm</p>
                </div>
                <button
                  onClick={() => unlinkGrandparent(g.id)}
                  disabled={removing === g.id}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:border-terra hover:text-terra disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        )}
        {grandparents.length === 0 && pendingGrandparents.length === 0 ? (
          <p className="mb-3 text-xs text-ink-muted">
            No grandparents linked yet — enter a family code below to connect.
          </p>
        ) : (
          <div className="mb-4 space-y-2">
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
                <button
                  onClick={() => unlinkGrandparent(g.id)}
                  disabled={removing === g.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-muted transition-colors hover:border-terra hover:text-terra disabled:opacity-50"
                >
                  <Unlink size={13} /> {removing === g.id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-muted">Add another grandparent</p>
        <div className="flex gap-2">
          <input
            value={linkCode}
            onChange={(e) => setLinkCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && linkToGrandparent()}
            placeholder="Family code — e.g. 6PWM87"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-card-soft px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-ink outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-muted"
          />
          <button
            onClick={linkToGrandparent}
            disabled={linkBusy || !linkCode.trim()}
            className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {linkBusy ? 'Linking…' : 'Link'}
          </button>
        </div>
        {linkError && <p className="mt-2 text-xs font-semibold text-terra">{linkError}</p>}
        {linkDone && <p className="mt-2 text-xs font-bold text-sage">{linkMessage}</p>}
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
          Ask each grandparent for their family code — it&apos;s shown when they created their account, and in their Settings → Your Family Code.
        </p>
      </section>
    </div>
  );
}
