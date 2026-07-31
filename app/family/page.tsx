'use client';
import { useEffect, useState, useCallback } from 'react';
import { LANGS } from '../lib/langs';

type Message = {
  id: string;
  sender_name: string;
  original_text: string;
  original_language?: string;
  translated_text: string;
  created_at?: string;
};

type FamilyMember = { id: string; name: string; relation: string };

type ReplyStatus = 'idle' | 'translating' | 'sending' | 'sent';

export default function FamilyDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [senderId, setSenderId] = useState('');
  const [grandmaLang, setGrandmaLang] = useState('ta-IN');
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<ReplyStatus>('idle');
  const [replyError, setReplyError] = useState('');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      setMessages(data || []);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Could not reach the server — is the app running?');
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/family-members')
      .then((r) => r.json())
      .then((d: FamilyMember[]) => {
        setFamily(Array.isArray(d) ? d : []);
        if (Array.isArray(d) && d.length > 0) setSenderId(d[0].id);
      })
      .catch(() => {});
    const id = setInterval(load, 2500);
    return () => clearInterval(id);
  }, [load]);

  const sendReply = async () => {
    const text = replyText.trim();
    if (!text || !senderId) return;
    const sender = family.find((f) => f.id === senderId);
    setReplyStatus('translating');
    setReplyError('');
    try {
      const tr = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          source_language_code: 'en-IN',
          target_language_code: grandmaLang,
        }),
      });
      const trData = await tr.json();
      if (!tr.ok || !trData.translated_text) throw new Error(trData.error || 'Translation failed');

      setReplyStatus('sending');
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: sender?.name || 'Family',
          original_text: text,
          original_language: 'en-IN',
          translated_text: trData.translated_text,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Send failed');
      }
      setReplyText('');
      setReplyStatus('sent');
      setTimeout(() => setReplyStatus('idle'), 3000);
    } catch (err: any) {
      setReplyStatus('idle');
      setReplyError(err.message || 'Reply failed — please try again.');
    }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 85% -10%, rgba(34,58,94,0.08), transparent 60%), #F9F4EA',
      padding: 24,
      fontFamily: 'var(--font-geist-sans), var(--font-tamil), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#223A5E', margin: 0 }}>Family Dashboard</h1>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700,
            color: '#6E8F6B', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#6E8F6B',
              animation: 'live-pulse 1.6s ease-in-out infinite',
            }} />
            Live
          </span>
        </div>
        <p style={{ fontSize: 13, color: '#5B5347', margin: '0 0 20px' }}>
          Messages from grandma appear here automatically.
        </p>

        {/* Reply composer */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, border: '1px solid rgba(43,38,32,0.10)',
          boxShadow: '0 6px 20px rgba(34,58,94,0.08)', padding: 18, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              style={{
                flex: 1, padding: '10px 12px', fontSize: 13, fontWeight: 600,
                borderRadius: 12, border: '1px solid rgba(43,38,32,0.15)', background: '#F9F4EA',
                color: '#2B2620',
              }}
            >
              {family.map((f) => (
                <option key={f.id} value={f.id}>{f.name} ({f.relation})</option>
              ))}
            </select>
            <select
              value={grandmaLang}
              onChange={(e) => setGrandmaLang(e.target.value)}
              title="Grandma's language"
              style={{
                padding: '10px 12px', fontSize: 13, fontWeight: 600,
                borderRadius: 12, border: '1px solid rgba(43,38,32,0.15)', background: '#F9F4EA',
                color: '#2B2620',
              }}
            >
              {LANGS.filter((l) => l.code !== 'en-IN').map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </div>
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            placeholder="Type a reply in English… e.g. I'll visit you tomorrow"
            disabled={replyStatus === 'translating' || replyStatus === 'sending'}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 14, marginBottom: 10,
              borderRadius: 12, border: '1px solid rgba(43,38,32,0.15)',
              color: '#2B2620',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={sendReply}
              disabled={replyStatus === 'translating' || replyStatus === 'sending' || !replyText.trim()}
              style={{
                padding: '10px 22px', background: '#6E8F6B', color: 'white', border: 'none',
                borderRadius: 100, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                opacity: replyStatus === 'translating' || replyStatus === 'sending' || !replyText.trim() ? 0.6 : 1,
              }}
            >
              {replyStatus === 'translating' ? 'Translating…' : replyStatus === 'sending' ? 'Sending…' : 'Reply to Grandma'}
            </button>
            {replyStatus === 'sent' && (
              <span style={{ color: '#6E8F6B', fontSize: 13, fontWeight: 700 }}>Sent ✓</span>
            )}
          </div>
          {replyError && (
            <p style={{ color: '#C1502E', fontSize: 12, marginTop: 10, fontWeight: 600 }}>{replyError}</p>
          )}
          <p style={{ fontSize: 11, color: '#8A8175', marginTop: 10 }}>
            Your English reply is translated to {LANGS.find((l) => l.code === grandmaLang)?.name} and read aloud on grandma's device.
          </p>
        </div>

        {error && (
          <p style={{ color: '#C1502E', fontSize: 13, marginBottom: 16, fontWeight: 600 }}>{error}</p>
        )}

        {messages.length === 0 && !error && (
          <div style={{
            background: '#FFFFFF', borderRadius: 20, border: '1px dashed rgba(43,38,32,0.20)',
            padding: 48, textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📣</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#2B2620', margin: '0 0 4px' }}>
              Waiting for grandma's first message…
            </p>
            <p style={{ fontSize: 13, color: '#5B5347', margin: 0 }}>
              Open the app on her phone, tap Speak, and say something in Tamil.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map(m => (
            <div key={m.id} style={{
              background: '#FFFFFF', borderRadius: 20,
              border: '1px solid rgba(43,38,32,0.10)',
              boxShadow: '0 6px 20px rgba(34,58,94,0.08)',
              padding: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%', background: '#E7A33E', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {(m.sender_name || 'G')[0]}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#223A5E' }}>{m.sender_name}</span>
                </span>
                <span style={{ fontSize: 12, color: '#8A8175' }}>{formatTime(m.created_at)}</span>
              </div>

              <div style={{ fontSize: 17, lineHeight: 1.5, color: '#2B2620', marginBottom: 10 }}>
                {m.original_text}
              </div>

              <div style={{ background: '#223A5E', color: 'white', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#B9C7DA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                  Translated {m.original_language ? `· ${m.original_language}` : ''}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.5 }}>{m.translated_text}</div>
              </div>
            </div>
          ))}
        </div>

        {lastUpdated && messages.length > 0 && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#8A8175', marginTop: 16 }}>
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>

      <style>{`
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
