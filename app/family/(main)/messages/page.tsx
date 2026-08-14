'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { nativeName } from '../../../lib/langs';

type LinkedGrandparent = { id: string; name: string; language?: string | null };
type Member = { id: string; name: string; relation: string };
type Message = {
  id: string;
  sender_name: string;
  original_text: string;
  original_language?: string;
  translated_text: string;
  created_at?: string;
};
type ReplyStatus = 'idle' | 'translating' | 'sending' | 'sent';

function fmtTime(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FamilyMessagesPage() {
  const [member, setMember] = useState<Member | null>(null);
  const [grandparents, setGrandparents] = useState<LinkedGrandparent[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState<ReplyStatus>('idle');
  const [error, setError] = useState('');
  const [replyError, setReplyError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const loadInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('unauth');
        const d = await r.json();
        if (cancelled) return;
        if (d.member) setMember(d.member);
        const gps: LinkedGrandparent[] = Array.isArray(d.linkedGrandparents) ? d.linkedGrandparents : [];
        setGrandparents(gps);
        setRecipientId((cur) => cur || gps[0]?.id || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      setError('');
      setLastUpdated(new Date());
    } catch {
      setError('Could not reach the server — is the app running?');
    } finally {
      loadInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [load]);

  // Which language should the reply be translated into? The selected
  // grandparent's own language (from her profile), overridable in family
  // Settings, falling back to Tamil. Read defensively (never during SSR).
  const selectedGp = grandparents.find((g) => g.id === recipientId);
  const replyLang = (() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('bridge-family-reply-lang');
        if (saved) return saved;
      }
    } catch {}
    return selectedGp?.language || 'ta-IN';
  })();

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || !recipientId) return;
    setStatus('translating');
    setReplyError('');
    try {
      const tr = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          source_language_code: 'en-IN',
          target_language_code: replyLang,
        }),
      });
      const trData = await tr.json();
      if (!tr.ok || !trData.translated_text) throw new Error(trData.error || 'Translation failed');

      setStatus('sending');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: member?.name || 'Family',
          original_text: text,
          original_language: 'en-IN',
          translated_text: trData.translated_text,
          recipient_profile_id: recipientId,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Send failed');
      }
      setReplyText('');
      setStatus('sent');
      load();
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err: unknown) {
      setStatus('idle');
      setReplyError(err instanceof Error ? err.message : 'Reply failed — please try again.');
    }
  };

  // A message counts as "from grandma" if the sender is one of the linked
  // grandparents — so bubbles are attributed correctly per recipient.
  const grandmaNames = grandparents.map((g) => g.name);
  const fromGrandma = (m: Message) => grandmaNames.includes(m.sender_name);

  if (!member) {
    return (
      <p className="rounded-3xl border border-line bg-card p-10 text-center text-sm text-ink-muted">
        Checking your session…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">Messages</h2>
        <p className="text-sm text-ink-muted">
          Your reply is translated into {nativeName(replyLang)} and read aloud on grandma&apos;s device.
        </p>
      </div>

      {grandparents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-card p-10 text-center">
          <div className="mb-3 text-4xl">👵</div>
          <p className="text-sm font-bold text-ink">You&apos;re not linked to a grandparent yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Ask your grandparent for their family code (it&apos;s shown when they created their account), then add it in Settings.
          </p>
          <Link
            href="/family/settings"
            className="mt-4 inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Open Settings
          </Link>
        </div>
      ) : (
        <>
          {/* Composer — who do you want to send to? */}
          <div className="rounded-3xl border border-line bg-card p-4 shadow-soft">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-ink-muted">
              Send to
            </label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              className="mb-3 w-full rounded-2xl border border-line bg-card-soft px-4 py-3 text-sm font-semibold text-ink outline-none"
            >
              {grandparents.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}{g.language ? ` · ${nativeName(g.language)}` : ''}
                </option>
              ))}
            </select>

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendReply())}
              placeholder="Type your message in English… e.g. I'll visit you tomorrow"
              disabled={status === 'translating' || status === 'sending'}
              rows={2}
              className="w-full resize-none rounded-2xl border border-line bg-card-soft px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={sendReply}
                disabled={status === 'translating' || status === 'sending' || !replyText.trim()}
                className="rounded-full bg-sage px-6 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === 'translating' ? 'Translating…' : status === 'sending' ? 'Sending…' : `Send to ${selectedGp?.name || 'grandma'}`}
              </button>
              {status === 'sent' && <span className="text-sm font-bold text-sage">Sent ✓</span>}
            </div>
            {replyError && (
              <p className="mt-2 text-xs font-semibold text-terra">{replyError}</p>
            )}
          </div>

          {/* Conversation */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">Conversation</h3>
            {error && <p className="mb-3 text-xs text-terra">{error}</p>}
            {messages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line bg-card p-10 text-center">
                <div className="mb-2 text-3xl">📣</div>
                <p className="text-sm font-bold text-ink">No messages yet</p>
                <p className="mt-1 text-xs text-ink-muted">
                  When {selectedGp?.name || 'grandma'} speaks to the AI companion, her messages appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((m) => {
                  const isGrandma = fromGrandma(m);
                  return (
                    <div key={m.id} className={`flex gap-3 ${isGrandma ? '' : 'flex-row-reverse'}`}>
                      <div
                        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          isGrandma ? 'bg-brand-soft text-brand' : 'bg-sage-soft text-sage'
                        }`}
                      >
                        {(m.sender_name || 'G')[0]}
                      </div>
                      <div className={`min-w-0 flex-1 space-y-2 ${isGrandma ? '' : 'text-right'}`}>
                        <div className={`flex items-baseline gap-2 ${isGrandma ? '' : 'justify-end'}`}>
                          <p className="text-sm font-semibold text-ink">{m.sender_name}</p>
                          <p className="text-[11px] text-ink-muted">{fmtTime(m.created_at)}</p>
                        </div>
                        <div
                          className={`block w-fit max-w-full rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink ${isGrandma ? 'rounded-tl-sm' : 'rounded-tr-sm'}`}
                        >
                          {m.original_text}
                        </div>
                        <div
                          className={`block w-fit max-w-full rounded-2xl px-4 py-3 text-left text-sm text-white ${isGrandma ? 'rounded-tl-sm bg-brand' : 'rounded-tr-sm bg-sage'}`}
                        >
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/60">
                            Translated
                          </span>
                          {m.translated_text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {lastUpdated && messages.length > 0 && (
              <p className="mt-4 text-center text-[11px] text-ink-muted">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
