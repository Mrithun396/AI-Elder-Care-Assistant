'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LANGS } from '../../lib/langs';

type Profile = {
  id: string;
  role: 'grandparent' | 'family';
  name: string;
  language?: string | null;
  link_code?: string | null;
  linked_to?: string | null;
};

export default function GrandparentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState('ta-IN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // After signup the fresh link code is shown once, big, so grandma can share
  // it with family. It is also always available in Settings afterwards.
  const [justCreated, setJustCreated] = useState<Profile | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('not signed in');
        const d = await r.json();
        if (!cancelled && d.role === 'grandparent') {
          router.replace('/home');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(
        mode === 'signin' ? '/api/auth/grandparent-login' : '/api/auth/grandparent-signup',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, language }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong — please try again.');
      const profile: Profile = data.profile;
      // Seed the app language from the profile so the grandma UI speaks her
      // chosen language right away (falls back to Tamil if unset).
      try {
        if (profile.language) localStorage.setItem('bridge-lang', profile.language);
      } catch {}
      if (mode === 'signup') {
        setJustCreated(profile);
      } else {
        router.push('/home');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    const code = justCreated?.link_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the code is still shown on screen
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

  // The one-time link-code reveal after account creation.
  if (justCreated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(900px 500px at 15% -10%, rgba(231,163,62,0.12), transparent 60%), radial-gradient(1200px 600px at 85% -10%, rgba(34,58,94,0.10), transparent 60%), #F9F4EA',
          padding: 24,
          fontFamily:
            'var(--font-geist-sans), var(--font-tamil), -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#223A5E', margin: 0 }}>
              Your account is ready 🎉
            </h1>
            <p style={{ fontSize: 13, color: '#5B5347', margin: '8px 0 0' }}>
              Share this code with your family so they can link to you:
            </p>
          </div>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 24,
              border: '1px solid rgba(43,38,32,0.10)',
              boxShadow: '0 6px 20px rgba(34,58,94,0.08)',
              padding: 28,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: '0.28em',
                color: '#223A5E',
                background: '#F9F4EA',
                borderRadius: 16,
                padding: '18px 8px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {justCreated.link_code}
            </div>
            <button
              onClick={copyCode}
              style={{
                marginTop: 16,
                background: 'none',
                border: '1px solid rgba(43,38,32,0.20)',
                borderRadius: 100,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 700,
                color: '#5B5347',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied ✓' : 'Copy code'}
            </button>
            <p style={{ fontSize: 12, color: '#8A8175', margin: '14px 0 0', lineHeight: 1.5 }}>
              Family members enter this code when signing up, and the two accounts
              get linked. You can also find it anytime in Settings → Your Family Code.
            </p>
          </div>

          <button
            onClick={() => {
              router.push('/home');
              router.refresh();
            }}
            style={{
              marginTop: 18,
              width: '100%',
              padding: '14px 0',
              background: '#223A5E',
              color: 'white',
              border: 'none',
              borderRadius: 100,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Start using Bridge →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(900px 500px at 15% -10%, rgba(231,163,62,0.12), transparent 60%), radial-gradient(1200px 600px at 85% -10%, rgba(34,58,94,0.10), transparent 60%), #F9F4EA',
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
              background: 'linear-gradient(135deg, #E7A33E, #D98A2B)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              margin: '0 auto 14px',
              boxShadow: '0 10px 24px rgba(231,163,62,0.35)',
            }}
          >
            👵
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#223A5E', margin: 0 }}>Grandparent Portal</h1>
          <p style={{ fontSize: 13, color: '#5B5347', margin: '6px 0 0' }}>
            Your AI companion — in your language, whenever you need it.
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
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
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
                  <label style={labelStyle} htmlFor="gp-name">Your name</label>
                  <input
                    id="gp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kamala"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle} htmlFor="gp-lang">Your language</label>
                  <select
                    id="gp-lang"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={inputStyle}
                  >
                    {LANGS.map((l) => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={labelStyle} htmlFor="gp-email">Email</label>
              <input
                id="gp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle} htmlFor="gp-password">Password</label>
              <input
                id="gp-password"
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
              ? 'First time here? Create an account to get your family code.'
              : 'After signing up you get a family code to share with your family.'}
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#8A8175', marginTop: 18 }}>
          <Link href="/family/login" style={{ color: '#223A5E', fontWeight: 700, textDecoration: 'none' }}>
            Are you a family member? Sign in here →
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
