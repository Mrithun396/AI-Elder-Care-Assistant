'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartHandshake, UserRound, Users, ChevronRight } from 'lucide-react';

export default function RoleChooserPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Already signed in? Send each role to their own side of the app.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (r) => {
        if (!r.ok) throw new Error('not signed in');
        const d = await r.json();
        if (cancelled) return;
        if (d.role === 'grandparent') router.replace('/home');
        else if (d.role === 'family') router.replace('/family');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

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
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: 'linear-gradient(135deg, #223A5E, #2F5580)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 12px 28px rgba(34,58,94,0.32)',
            }}
          >
            <HeartHandshake size={34} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#223A5E', margin: 0 }}>Bridge</h1>
          <p style={{ fontSize: 14, color: '#5B5347', margin: '8px 0 0' }}>
            Connecting generations through AI.
          </p>
        </div>

        {checking ? (
          <p style={{ textAlign: 'center', fontSize: 14, color: '#8A8175' }}>Checking…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Link
              href="/grandparent/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#FFFFFF',
                borderRadius: 24,
                border: '1px solid rgba(43,38,32,0.10)',
                boxShadow: '0 6px 20px rgba(34,58,94,0.08)',
                padding: 22,
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(34,58,94,0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,58,94,0.08)';
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #E7A33E, #D98A2B)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UserRound size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#2B2620' }}>I&apos;m the Grandparent</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5B5347' }}>
                  Use the AI companion, messages, medicines and more — in your language.
                </p>
              </div>
              <ChevronRight size={20} style={{ color: '#8A8175', flexShrink: 0 }} />
            </Link>

            <Link
              href="/family/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: '#FFFFFF',
                borderRadius: 24,
                border: '1px solid rgba(43,38,32,0.10)',
                boxShadow: '0 6px 20px rgba(34,58,94,0.08)',
                padding: 22,
                textDecoration: 'none',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(34,58,94,0.16)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(34,58,94,0.08)';
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #6E8F6B, #578052)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Users size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#2B2620' }}>I&apos;m a Family Member</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#5B5347' }}>
                  See health updates, messages and alerts — and reply to grandma.
                </p>
              </div>
              <ChevronRight size={20} style={{ color: '#8A8175', flexShrink: 0 }} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
