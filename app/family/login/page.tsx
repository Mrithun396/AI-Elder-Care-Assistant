'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function FamilyLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(mode === 'signin' ? '/api/auth/login' : '/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, relation, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
      router.push('/family');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    borderRadius: 12,
    border: '1px solid rgba(43,38,32,0.15)',
    background: '#F9F4EA',
    color: '#2B2620',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#5B5347',
    marginBottom: 6,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(900px 500px at 15% -10%, rgba(231,163,62,0.10), transparent 60%), radial-gradient(1200px 600px at 85% -10%, rgba(34,58,94,0.08), transparent 60%), #F9F4EA',
        padding: 24,
        fontFamily:
          'var(--font-geist-sans), var(--font-tamil), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'linear-gradient(135deg, #223A5E, #2F5580)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              margin: '0 auto 14px',
              boxShadow: '0 10px 24px rgba(34,58,94,0.30)',
            }}
          >
            🏠
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#223A5E', margin: 0 }}>Family Portal</h1>
          <p style={{ fontSize: 13, color: '#5B5347', margin: '6px 0 0' }}>
            Sign in to see your grandparent&apos;s messages, health and alerts.
          </p>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            borderRadius: 24,
            border: '1px solid rgba(43,38,32,0.10)',
            boxShadow: '0 6px 20px rgba(34,58,94,0.08)',
            padding: 24,
          }}
        >
          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              background: '#F9F4EA',
              borderRadius: 12,
              padding: 4,
              marginBottom: 20,
            }}
          >
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 9,
                  border: 'none',
                  cursor: 'pointer',
                  background: mode === m ? '#FFFFFF' : 'transparent',
                  color: mode === m ? '#223A5E' : '#8A8175',
                  boxShadow: mode === m ? '0 2px 6px rgba(34,58,94,0.10)' : 'none',
                }}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <>
                <div>
                  <label style={labelStyle} htmlFor="fm-name">Name</label>
                  <input
                    id="fm-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Arun"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="fm-relation">Relation</label>
                  <input
                    id="fm-relation"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    placeholder="e.g. Son, Daughter"
                    style={inputStyle}
                  />
                </div>
              </>
            )}
            <div>
              <label style={labelStyle} htmlFor="fm-email">Email</label>
              <input
                id="fm-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="fm-password">Password</label>
              <input
                id="fm-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#C1502E', lineHeight: 1.4 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                padding: '13px 0',
                background: '#223A5E',
                color: 'white',
                border: 'none',
                borderRadius: 100,
                fontSize: 14,
                fontWeight: 700,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account & sign in'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#8A8175', marginTop: 18, lineHeight: 1.5 }}>
            {mode === 'signin'
              ? 'First time here? Switch to "Create account" to add a family member.'
              : 'The account is linked to a family member so your replies are sent as you.'}
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#8A8175', marginTop: 18 }}>
          <Link href="/grandparent/login" style={{ color: '#223A5E', fontWeight: 700, textDecoration: 'none' }}>
            Are you the grandparent? Sign in here →
          </Link>
        </p>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#8A8175', marginTop: 8 }}>
          <Link href="/" style={{ color: '#8A8175', textDecoration: 'none' }}>
            ← Choose a different option
          </Link>
        </p>
      </div>
    </div>
  );
}
