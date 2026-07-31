'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import TalkAndTranslate from '../../components/TalkAndTranslate';
import { GRANDMA_NAME, grandmaLangCode, nativeName } from '../../lib/langs';
import { T, translate, useLang } from '../../lib/i18n';
import { playSpeech, stopSpeech } from '../../lib/audio';

type Message = {
  id: string;
  sender_name: string;
  original_text: string;
  original_language?: string;
  translated_text: string;
  created_at?: string;
};

function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessagesPage() {
  const lang = useLang();
  const [history, setHistory] = useState<Message[]>([]);
  const [error, setError] = useState('');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState('');
  const loadInFlight = useRef(false);
  const speakingIdRef = useRef<string | null>(null);
  // Bumps on every speak() call; a fetch that resolves after a newer tap is
  // stale and must not play or touch UI state — "last tap wins".
  const speakSeq = useRef(0);

  const isReply = (m: Message) => m.sender_name !== GRANDMA_NAME;

  const speak = useCallback(async (m: Message) => {
    if (speakingIdRef.current === m.id) return;
    const mySeq = ++speakSeq.current;
    const targetLang = isReply(m) ? grandmaLangCode() : 'en-IN';
    try {
      // Shared app-wide audio: stops any playback in progress (a message
      // bubble or the reply notifier) and resets its UI state.
      stopSpeech();
      speakingIdRef.current = m.id;
      setTtsError('');
      setSpeakingId(m.id);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: m.translated_text, target_language_code: targetLang }),
      });
      const data = await res.json();
      if (!res.ok || !data.audio) throw new Error(data.error || 'TTS failed');
      if (mySeq !== speakSeq.current) return; // superseded by a newer tap
      playSpeech(data.audio, () => {
        if (speakingIdRef.current === m.id) {
          setSpeakingId(null);
          speakingIdRef.current = null;
        }
      });
    } catch (err: any) {
      if (mySeq !== speakSeq.current) return; // don't clobber a newer tap
      setSpeakingId(null);
      speakingIdRef.current = null;
      setTtsError(translate(lang, 'messages.ttsError'));
    }
  }, [lang]);

  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const list: Message[] = Array.isArray(data) ? data : [];
      setHistory(list);
      setError('');
    } catch {
      setError(translate(lang, 'messages.loadError'));
    } finally {
      loadInFlight.current = false;
    }
  }, [speak, lang]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2500);
    return () => {
      clearInterval(id);
      stopSpeech();
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink"><T k="messages.title" /></h1>
        <p className="text-sm text-ink-muted"><T k="messages.subtitle" /></p>
      </div>

      <TalkAndTranslate />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted"><T k="messages.conversation" /></h2>
        {error && <p className="mb-3 text-xs text-terra">{error}</p>}
        {ttsError && (
          <p className="mb-3 rounded-2xl bg-terra-soft px-4 py-2 text-xs font-semibold text-terra">{ttsError}</p>
        )}
        {history.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line bg-card p-8 text-center">
            <p className="text-sm font-semibold text-ink"><T k="messages.empty" /></p>
            <p className="mt-1 text-xs text-ink-muted">{translate(lang, 'messages.emptySub')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((m) => {
              const reply = isReply(m);
              return (
                <div key={m.id} className={`flex gap-3 ${reply ? 'flex-row-reverse' : ''}`}>
                  <div
                    className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      reply ? 'bg-sage-soft text-sage' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    {(m.sender_name || 'K')[0]}
                  </div>
                  <div className={`min-w-0 flex-1 space-y-2 ${reply ? 'text-right' : ''}`}>
                    <div className={`flex items-baseline gap-2 ${reply ? 'justify-end' : ''}`}>
                      <p className="text-sm font-semibold text-ink">{m.sender_name}</p>
                      <p className="text-[11px] text-ink-muted">{fmtTime(m.created_at)}</p>
                      {m.original_language && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            reply ? 'bg-sage-soft text-sage' : 'bg-brand-soft text-brand'
                          }`}
                        >
                          {m.original_language}
                        </span>
                      )}
                    </div>
                    {/* Original text: Tamil from grandma, English from family */}
                    <div
                      className={`inline-block max-w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink ${
                        reply ? 'rounded-tr-sm text-left' : 'rounded-tl-sm text-left'
                      }`}
                    >
                      {m.original_text}
                    </div>
                    <div className="flex items-start gap-2">
                      <div
                        className={`inline-block max-w-full rounded-2xl px-4 py-3 text-sm text-left ${
                          reply ? 'rounded-tr-sm bg-sage text-white' : 'rounded-tl-sm bg-brand text-white'
                        }`}
                      >
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/60">
                          {reply ? nativeName(grandmaLangCode()) : translate(lang, 'messages.langEnglish')}
                        </span>
                        {m.translated_text}
                      </div>
                      <button
                        onClick={() => {
                          if (speakingId === m.id) {
                            speakSeq.current++; // cancel any in-flight fetch too
                            stopSpeech();
                          } else {
                            speak(m);
                          }
                        }}
                        aria-label={translate(lang, 'messages.playAloud')}
                        className={`mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:bg-card-soft hover:text-ink ${
                          speakingId === m.id ? 'bg-accent-soft text-accent' : ''
                        }`}
                      >
                        {speakingId === m.id ? <span className="h-2 w-2 animate-ping rounded-full bg-accent" /> : <Volume2 size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
