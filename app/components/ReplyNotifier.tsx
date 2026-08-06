'use client';
import { useEffect, useRef, useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { GRANDMA_NAME, grandmaLangCode, grandmaVoice } from '../lib/langs';
import { T, fmt, translate, useLang } from '../lib/i18n';
import { playSpeech, stopSpeech } from '../lib/audio';

type Message = {
  id: string;
  sender_name: string;
  original_text: string;
  translated_text: string;
  created_at?: string;
};

const POLL_MS = 3000;
const AUTO_DISMISS_MS = 20000;

export default function ReplyNotifier() {
  const lang = useLang();
  const [notice, setNotice] = useState<Message | null>(null);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState('');
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);
  const autoTimer = useRef<number | null>(null);
  const pendingRef = useRef<Message | null>(null);
  // Busy guard: while a read is in-flight or playing, ignore extra taps so
  // rapid double-clicks can't stack overlapping TTS fetches (echo).
  const speakingRef = useRef(false);

  const isReply = (m: Message) => m.sender_name !== GRANDMA_NAME;

  const stopAudio = () => {
    speakingRef.current = false;
    stopSpeech();
    setPlaying(false);
  };

  // Reads the reply aloud, announcing the sender first, in grandma's language.
  const speak = async (m: Message) => {
    if (speakingRef.current) return; // already reading — ignore repeat tap
    try {
      stopAudio(); // clears speakingRef; re-arm it below before the async work
      speakingRef.current = true;
      setErr('');
      setPlaying(true);
      // Keep the toast alive while grandma is listening (manual replay).
      scheduleDismiss();
      const says = translate(lang, 'notif.says'); // e.g. "சொல்கிறார்" (says)
      const text = `${m.sender_name} ${says}: ${m.translated_text}`;
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target_language_code: grandmaLangCode(), speaker: grandmaVoice() }),
      });
      const data = await res.json();
      if (!res.ok || !data.audio) throw new Error(data.error || 'TTS failed');
      playSpeech(data.audio, () => {
        speakingRef.current = false;
        setPlaying(false);
      });
    } catch {
      speakingRef.current = false;
      setPlaying(false);
      setErr(translate(lang, 'messages.ttsError'));
    }
  };

  // Clears and re-arms the auto-dismiss timer so the toast stays while
  // grandma is listening (fresh arrival or manual replay).
  const scheduleDismiss = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = window.setTimeout(() => {
      setNotice(null);
      stopAudio();
    }, AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = null;
    stopAudio();
    setNotice(null);
  };

  // Only announce aloud while grandma is actually looking at this tab. If the
  // app sits in a background tab (e.g. the family member is using the family
  // dashboard in another tab), the reply is held until she returns — so audio
  // never plays over the family dashboard.
  const isInteractable = () =>
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus();

  const notify = (m: Message) => {
    // A fresh reply always announces — stop any current playback first.
    // (Each reply notifies only once thanks to seenIds, so no echo here.)
    stopAudio();
    setNotice(m);
    speak(m);
    scheduleDismiss();
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/messages');
        if (!res.ok) return;
        const data = await res.json();
        const list: Message[] = Array.isArray(data) ? data : [];

        // Seed history silently on the very first poll; notify only for
        // replies that arrive while the app is open.
        if (firstLoad.current) {
          list.forEach((m) => seenIds.current.add(m.id));
          firstLoad.current = false;
          return;
        }

        const newReplies = list.filter((m) => isReply(m) && !seenIds.current.has(m.id));
        list.forEach((m) => seenIds.current.add(m.id));

        if (newReplies.length > 0 && !cancelled) {
          const latest = newReplies[0]; // newest first
          if (isInteractable()) {
            notify(latest);
          } else {
            // Tab is in the background — hold the newest reply for when
            // grandma switches back to the app.
            pendingRef.current = latest;
          }
        }
      } catch {
        // transient — retry on next tick
      }
    };

    // When grandma switches back to this tab, announce the held reply.
    const flushPending = () => {
      if (pendingRef.current && isInteractable()) {
        const held = pendingRef.current;
        pendingRef.current = null;
        notify(held);
      }
    };

    load();
    const id = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', flushPending);
    window.addEventListener('focus', flushPending);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', flushPending);
      window.removeEventListener('focus', flushPending);
      if (autoTimer.current) clearTimeout(autoTimer.current);
      stopAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  if (!notice) return null;

  return (
    <div className="fixed top-16 lg:top-6 right-3 lg:right-6 z-50 w-[min(92vw,360px)]">
      <div className="anim-notif relative w-full rounded-3xl border border-line bg-card p-4 pr-11 text-left shadow-soft transition-shadow hover:shadow-lg">
        <span
          role="button"
          tabIndex={0}
          aria-label={translate(lang, 'notif.close')}
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              dismiss();
            }
          }}
          className="absolute top-3 right-3 z-10 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-card-soft hover:text-ink"
        >
          <X size={16} />
        </span>
        <div
          role="button"
          tabIndex={0}
          onClick={() => speak(notice)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              speak(notice);
            }
          }}
          className="cursor-pointer"
        >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-base font-bold">
            {(notice.sender_name || 'F')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
                <T k="notif.newMessage" />
              </p>
              {playing && (
                <span className="h-2 w-2 animate-ping rounded-full bg-accent" />
              )}
            </div>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">
              {fmt(lang, 'notif.from', { name: notice.sender_name })}
            </p>
            <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-muted">
              {notice.translated_text}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-brand">
              <Volume2 size={14} className={playing ? 'animate-pulse' : ''} />
              <T k="notif.tapToHear" />
            </p>
          </div>
        </div>
        </div>
      </div>
      {err && (
        <p className="mt-1.5 rounded-xl bg-terra-soft px-3 py-1.5 text-[11px] font-semibold text-terra">
          {err}
        </p>
      )}
    </div>
  );
}
