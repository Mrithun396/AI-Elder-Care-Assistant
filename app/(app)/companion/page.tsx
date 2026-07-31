'use client';
import { useState } from 'react';
import { Mic, Sparkles, BookOpen, Newspaper, MessagesSquare, Laugh } from 'lucide-react';
import { T, fmt, translate, useLang } from '../../lib/i18n';

const SUGGESTIONS = [
  { key: 'comp.story', icon: BookOpen },
  { key: 'comp.news', icon: Newspaper },
  { key: 'comp.talk', icon: MessagesSquare },
  { key: 'comp.joke', icon: Laugh },
];

type Turn = { from: 'user' | 'ai'; key: string; arg?: string };

export default function CompanionPage() {
  const lang = useLang();
  const [listening, setListening] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([{ from: 'ai', key: 'comp.welcome' }]);

  const pick = (label: string) => {
    setTurns((t) => [
      ...t,
      { from: 'user', key: label },
      { from: 'ai', key: 'comp.demoReply', arg: label },
    ]);
  };

  const toggleMic = () => {
    if (listening) {
      setListening(false);
      setTurns((t) => [
        ...t,
        { from: 'user', key: 'comp.voiceNote' },
        { from: 'ai', key: 'comp.heard' },
      ]);
    } else {
      setListening(true);
      setTimeout(() => setListening(false), 2200);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="comp.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="comp.subtitle" /></p>
      </div>

      {/* Mic */}
      <div className="flex flex-col items-center rounded-3xl border border-line bg-card p-8 shadow-soft">
        <button
          onClick={toggleMic}
          className={`flex h-24 w-24 items-center justify-center rounded-full text-white transition-all ${
            listening
              ? 'bg-terra sos-pulse scale-105'
              : 'bg-gradient-to-br from-accent to-brand shadow-soft hover:scale-105'
          }`}
          aria-label="Talk to AI"
        >
          <Mic size={36} />
        </button>
        <p className="mt-4 text-sm font-semibold text-ink">
          <T k={listening ? 'comp.listening' : 'comp.tapToTalk'} />
        </p>
        <p className="text-xs text-ink-muted">{translate(lang, 'comp.voicePreview')}</p>
      </div>

      {/* Suggestions */}
      <div className="grid grid-cols-2 gap-3">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => pick(s.key)}
            className="anim-fade-up flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-left text-sm font-semibold text-ink transition-all hover:-translate-y-0.5 hover:shadow-soft"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <s.icon size={18} />
            </span>
            <T k={s.key} />
          </button>
        ))}
      </div>

      {/* Conversation */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="comp.conversation" /></h2>
        <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
          {turns.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.from === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  t.from === 'user'
                    ? 'rounded-br-sm bg-accent text-white'
                    : 'rounded-bl-sm bg-brand-soft text-ink'
                }`}
              >
                <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {t.from === 'user' ? translate(lang, 'comp.you') : <Sparkles size={10} />}
                  {t.from === 'user' ? '' : translate(lang, 'comp.companion')}
                </span>
                {t.arg ? fmt(lang, t.key, { label: translate(lang, t.arg).toLowerCase() }) : translate(lang, t.key)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
