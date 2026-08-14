'use client';
import { useState, useRef, useEffect } from 'react';
import { T, fmt, translate, useLang } from '../lib/i18n';

type FamilyMember = { id: string; name: string; relation: string };

const SPEECH_SUSTAINED_RMS = 0.05; // avg of loudest samples must clear this to count as speech
const MIN_RECORDING_MS = 600;

export default function TalkAndTranslate() {
  const lang = useLang();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedFamily, setSelectedFamily] = useState('');
  // The grandparent's profile id, so her sent messages are tagged with
  // sender_profile_id and show up in her own filtered thread.
  const [senderProfileId, setSenderProfileId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ original_text: string; translated_text: string; original_language?: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<number | null>(null);
  const levelSamplesRef = useRef<number[]>([]);
  const recStartRef = useRef(0);
  const chunksRef = useRef<Blob[]>([]);
  const unmountedRef = useRef(false);

  useEffect(() => {
    // React StrictMode (dev) mounts -> unmounts -> remounts, so the cleanup
    // below runs once and would leave unmountedRef stuck true on the remount.
    // Reset it on every mount so handleStop never bails early in dev.
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      recorderRef.current?.stop();
      stopTracks();
    };
  }, []);

  useEffect(() => {
    fetch('/api/family-members')
      .then(res => res.json())
      .then(data => {
        setFamilyMembers(data);
        if (data.length > 0) setSelectedFamily(data[0].id);
      })
      .catch(() => setError(translate(lang, 'tnt.errFamily')));
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.role === 'grandparent' && d.profile?.id) setSenderProfileId(d.profile.id);
      })
      .catch(() => {});
  }, []);

  // Declared as a function (hoisted) so the unmount effect above can call it
  // without a temporal-dead-zone lint error.
  function stopTracks() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }

  const start = async () => {
    if (recording || loading) return;
    setError('');
    setResult(null);
    setSent(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Monitor actual mic level so we can reject silence before it reaches Sarvam
      // (ASR models hallucinate transcripts from quiet/noise-only clips).
      // Use sustained-speech detection: speech has loud peaks above the noise floor,
      // so the average of the loudest samples must clear a real speech level.
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      levelSamplesRef.current = [];
      recStartRef.current = Date.now();
      if (levelTimerRef.current) clearInterval(levelTimerRef.current);
      const buf = new Float32Array(analyser.fftSize);
      levelTimerRef.current = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        levelSamplesRef.current.push(Math.sqrt(sum / buf.length));
      }, 100);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : undefined;
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = handleStop;
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      stopTracks();
      setError(translate(lang, 'tnt.errMic'));
    }
  };

  const stop = () => {
    setLoading(true);
    recorderRef.current?.stop();
    setRecording(false);
  };

  // Belt-and-suspenders: even if handleStop's own guards somehow stall,
  // never leave the UI stuck on "Translating…" forever.
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
      setError(translate(lang, 'tnt.errTimeout'));
    }, 90000);
    return () => clearTimeout(t);
  }, [loading]);

  const handleStop = async () => {
    if (unmountedRef.current) return;
    setLoading(true);
    setError('');
    try {
      if (chunksRef.current.length === 0) {
        setError(translate(lang, 'tnt.errNoAudio'));
        return;
      }
      const durationMs = Date.now() - recStartRef.current;
      if (durationMs < MIN_RECORDING_MS) {
        setError(translate(lang, 'tnt.errShort'));
        return;
      }
      const samples = levelSamplesRef.current;
      const loudCount = Math.max(1, Math.ceil(samples.length * 0.3));
      const loudestAvg = [...samples]
        .sort((a, b) => b - a)
        .slice(0, loudCount)
        .reduce((sum, s) => sum + s, 0) / loudCount;
      if (loudestAvg < SPEECH_SUSTAINED_RMS) {
        setError(translate(lang, 'tnt.errNoSpeech'));
        return;
      }
      const mimeType = recorderRef.current?.mimeType || 'audio/webm';
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const fd = new FormData();
      fd.append('audio', blob, `recording.${ext}`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      let res: Response;
      try {
        res = await fetch('/api/translate-voice', { method: 'POST', body: fd, signal: controller.signal });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setError(translate(lang, 'tnt.errTimeout'));
        } else {
          setError(err.message || translate(lang, 'tnt.errFailed'));
        }
        return;
      } finally {
        clearTimeout(timer);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error === 'TIMEOUT' ? translate(lang, 'tnt.errTimeout') : data.error);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || translate(lang, 'tnt.errFailed'));
    } finally {
      stopTracks();
      setLoading(false);
    }
  };

  const send = async () => {
    if (!result || !selectedFamily) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selectedFamily,
          sender_profile_id: senderProfileId,
          original_text: result.original_text,
          original_language: result.original_language,
          translated_text: result.translated_text,
        }),
      });
      if (!res.ok) throw new Error(translate(lang, 'tnt.errSend'));
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const selectedName = familyMembers.find(f => f.id === selectedFamily)?.name;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
      fontFamily: 'var(--font-geist-sans), var(--font-tamil), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 460,
        background: 'var(--card)',
        borderRadius: 28,
        boxShadow: 'var(--shadow)',
        border: '1px solid var(--line)',
        padding: 32,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)', margin: '0 0 4px' }}><T k="tnt.title" /></h2>
        <p style={{ fontSize: 13, color: 'var(--ink-muted)', margin: '0 0 24px' }}><T k="tnt.subtitle" /></p>

        <label style={{ display: 'block', marginBottom: 8, fontWeight: 700, fontSize: 13, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <T k="tnt.sendTo" subClassName="normal-case tracking-normal" />
        </label>
        <select
          value={selectedFamily}
          onChange={(e) => setSelectedFamily(e.target.value)}
          style={{
            width: '100%', padding: '14px 16px', fontSize: 16, marginBottom: 28,
            borderRadius: 12, border: '1px solid var(--line)', background: 'var(--card-soft)',
            color: 'var(--ink)', fontWeight: 600,
          }}
        >
          {familyMembers.map(f => (
            <option key={f.id} value={f.id}>{f.name} ({f.relation})</option>
          ))}
        </select>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <button
            onClick={recording ? stop : start}
            disabled={loading}
            style={{
              width: 96, height: 96, borderRadius: '50%', border: '5px solid #FFFFFF',
              background: recording ? '#C1502E' : '#E7A33E',
              color: 'white', fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
              boxShadow: recording
                ? '0 0 0 8px rgba(193,80,46,0.18)'
                : '0 10px 24px rgba(231,163,62,0.45)',
              transition: 'box-shadow 0.3s ease',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <T k={recording ? 'tnt.stop' : 'tnt.speak'} center subClassName="text-white/75" />
          </button>

          {recording && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, marginTop: 16 }}>
              {[10, 18, 26, 14, 22, 12].map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: 4, height: h, borderRadius: 3, background: '#C1502E',
                    animation: `pulse-bar 0.9s ease-in-out ${i * 0.1}s infinite`,
                  }}
                />
              ))}
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700, color: '#C1502E' }}>{translate(lang, 'tnt.listening')}</span>
            </div>
          )}

          {!recording && !loading && (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginTop: 14, fontWeight: 600 }}>{translate(lang, 'tnt.tapAndSpeak')}</p>
          )}

          {loading && <p style={{ fontSize: 13, color: 'var(--accent)', marginTop: 14, fontWeight: 700 }}>{translate(lang, 'tnt.translating')}</p>}
        </div>

        {error && (
          <p style={{ color: '#C1502E', fontSize: 13, textAlign: 'center', marginBottom: 16, fontWeight: 600 }}>{error}</p>
        )}

        {result && (
          <>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 18, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}><T k="tnt.youSaid" subClassName="normal-case tracking-normal" /></div>
              <div style={{ fontSize: 18, lineHeight: 1.5, color: 'var(--ink)' }}>{result.original_text}</div>
            </div>
            <div style={{ background: '#223A5E', color: 'white', borderRadius: 20, padding: 18, marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#B9C7DA', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}><T k="tnt.translated" subClassName="normal-case tracking-normal text-white/60" /></div>
              <div style={{ fontSize: 16, lineHeight: 1.5 }}>{result.translated_text}</div>
            </div>

            {!sent ? (
              <button
                onClick={send}
                disabled={sending}
                style={{
                  width: '100%', padding: 16, background: '#6E8F6B', color: 'white',
                  border: 'none', borderRadius: 100, fontSize: 15, fontWeight: 700,
                  cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.6 : 1,
                }}
              >
                {sending
                  ? translate(lang, 'tnt.sending')
                  : selectedName
                  ? fmt(lang, 'tnt.sendToName', { name: selectedName })
                  : translate(lang, 'tnt.sendTo')}
              </button>
            ) : (
              <p style={{ textAlign: 'center', color: '#6E8F6B', fontWeight: 700, fontSize: 15 }}>
                {translate(lang, 'tnt.sent')}
              </p>
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse-bar {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
