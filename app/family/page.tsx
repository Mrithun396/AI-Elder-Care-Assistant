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

type Alert = {
  id: string;
  sender_name: string;
  message: string;
  location?: string;
  created_at?: string;
};

type Checkin = {
  id: string;
  metric: string;
  value: string;
  unit?: string;
  note?: string;
  flagged?: boolean;
  created_at?: string;
};

type Memory = {
  id: string;
  content: string;
  category?: string;
  created_at?: string;
};

const CHECKIN_META: Record<string, { label: string; icon: string }> = {
  sugar: { label: 'Sugar', icon: '🩸' },
  bp: { label: 'Blood Pressure', icon: '🫀' },
  steps: { label: 'Steps', icon: '👣' },
  water: { label: 'Water', icon: '💧' },
  mood: { label: 'Mood', icon: '😊' },
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  hospital: { label: 'Hospital', icon: '🏥' },
  date: { label: 'Important date', icon: '📅' },
  todo: { label: 'To-do', icon: '📝' },
  note: { label: 'Note', icon: '💭' },
};

export default function FamilyDashboard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [alert, setAlert] = useState<Alert | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
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

  const loadAlert = useCallback(async () => {
    try {
      const res = await fetch('/api/emergency');
      if (!res.ok) return;
      const data = await res.json();
      setAlert(data && data.status === 'active' ? data : null);
    } catch {
      // banner stays as-is on transient errors
    }
  }, []);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health-checkins');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setCheckins(data);
    } catch {
      // keep last known state on transient errors
    }
  }, []);

  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/memories');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setMemories(data);
    } catch {
      // keep last known state on transient errors
    }
  }, []);

  const deleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories?id=${id}`, { method: 'DELETE' });
      setMemories((m) => m.filter((x) => x.id !== id));
    } catch {
      // best-effort
    }
  };

  useEffect(() => {
    load();
    loadAlert();
    loadHealth();
    loadMemories();
    fetch('/api/family-members')
      .then((r) => r.json())
      .then((d: FamilyMember[]) => {
        setFamily(Array.isArray(d) ? d : []);
        if (Array.isArray(d) && d.length > 0) setSenderId(d[0].id);
      })
      .catch(() => {});
    const id = setInterval(() => {
      load();
      loadAlert();
      loadHealth();
      loadMemories();
    }, 2500);
    return () => clearInterval(id);
  }, [load, loadAlert, loadHealth, loadMemories]);

  const resolveAlert = async () => {
    try {
      await fetch('/api/emergency', { method: 'DELETE' });
    } catch {
      // best-effort
    }
    setAlert(null);
  };

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
        {alert && (
          <div
            role="alert"
            style={{
              background: 'linear-gradient(135deg, #C1502E, #A93E1F)',
              color: 'white', borderRadius: 20, padding: '16px 18px', marginBottom: 20,
              boxShadow: '0 10px 30px rgba(193,80,46,0.45)',
              animation: 'alert-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#FFD9C4', flexShrink: 0,
                  animation: 'live-pulse 1s ease-in-out infinite',
                }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                    🚨 Emergency — {alert.sender_name}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 600 }}>
                    {alert.message}{alert.created_at ? ` · ${formatTime(alert.created_at)}` : ''}
                  </p>
                  {alert.location && (
                    <a
                      href={alert.location}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
                        background: 'rgba(255,255,255,0.16)', color: 'white',
                        border: '1px solid rgba(255,255,255,0.35)', borderRadius: 100,
                        padding: '6px 14px', fontSize: 12, fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      📍 View location
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={resolveAlert}
                style={{
                  flexShrink: 0, background: 'rgba(255,255,255,0.16)', color: 'white', border: '1px solid rgba(255,255,255,0.35)',
                  borderRadius: 100, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
              >
                All clear ✓
              </button>
            </div>
          </div>
        )}
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

        {/* Abnormal readings — flagged automatically when out of safe range */}
        {checkins.some((c) => c.flagged) && (
          <div style={{
            background: '#FDF1EC', border: '1px solid rgba(193,80,46,0.35)',
            borderRadius: 20, padding: 18, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#A93E1F' }}>
                Readings need attention
              </h2>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#A93E1F', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {checkins.filter((c) => c.flagged).length} flagged
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {checkins.filter((c) => c.flagged).slice(0, 5).map((c) => {
                const meta = CHECKIN_META[c.metric] || { label: c.metric, icon: '📋' };
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5B5347' }}>{meta.label}</p>
                      {c.note && (
                        <p style={{ margin: 0, fontSize: 11, color: '#8A8175' }}>
                          {c.note.length > 60 ? `${c.note.slice(0, 57)}…` : c.note}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#C1502E' }}>
                      {c.value}{c.unit ? ` ${c.unit}` : ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#8A8175', minWidth: 44, textAlign: 'right' }}>
                      {formatTime(c.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Health updates from grandma */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, border: '1px solid rgba(43,38,32,0.10)',
          boxShadow: '0 6px 20px rgba(34,58,94,0.08)', padding: 18, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🩺</span>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#223A5E' }}>Health Updates</h2>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#6E8F6B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6E8F6B', animation: 'live-pulse 1.6s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          {checkins.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#8A8175' }}>
              No health readings yet — grandma can say her sugar, blood pressure or steps to the AI Companion.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Latest reading per metric (checkins are newest-first) */}
              {Object.values(
                checkins.reduce<Record<string, Checkin>>((acc, c) => {
                  if (!acc[c.metric]) acc[c.metric] = c;
                  return acc;
                }, {})
              ).map((c) => {
                const meta = CHECKIN_META[c.metric] || { label: c.metric, icon: '📋' };
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5B5347' }}>{meta.label}</p>
                      {c.note && (
                        <p style={{ margin: 0, fontSize: 11, color: '#8A8175' }}>
                          {c.note.length > 80 ? `${c.note.slice(0, 77)}…` : c.note}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: c.flagged ? '#C1502E' : '#2B2620' }}>
                      {c.flagged ? '⚠ ' : ''}{c.value}{c.unit ? ` ${c.unit}` : ''}
                    </span>
                    <span style={{ fontSize: 11, color: '#8A8175', minWidth: 44, textAlign: 'right' }}>
                      {formatTime(c.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Grandma's memory notes */}
        <div style={{
          background: '#FFFFFF', borderRadius: 20, border: '1px solid rgba(43,38,32,0.10)',
          boxShadow: '0 6px 20px rgba(34,58,94,0.08)', padding: 18, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#223A5E' }}>Grandma's Memory</h2>
          </div>
          {memories.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: '#8A8175' }}>
              Nothing saved yet — grandma can ask the AI Companion to remember dates, appointments or to-dos.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {memories.slice(0, 6).map((m) => {
                const meta = CATEGORY_META[m.category || 'note'] || CATEGORY_META.note;
                return (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#5B5347' }}>{meta.label}</p>
                      <p style={{ margin: 0, fontSize: 14, color: '#2B2620' }}>{m.content}</p>
                    </div>
                    <button
                      onClick={() => deleteMemory(m.id)}
                      title="Delete"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
                        color: '#8A8175', padding: 4, borderRadius: 8,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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
        @keyframes alert-in {
          from { opacity: 0; transform: translateY(-14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
