'use client';
import { useEffect, useState } from 'react';
import { MapPin, ExternalLink, CheckCircle2 } from 'lucide-react';

type Alert = {
  id: string;
  sender_name: string;
  message: string;
  location?: string;
  created_at?: string;
};

// The alert stores a Google Maps link (https://www.google.com/maps?q=lat,lng).
// Build a no-API-key embed URL from the same coordinates for the map bubble.
function embedUrl(location?: string): string | null {
  if (!location) return null;
  const m = location.match(/[?&]q=([^&]+)/);
  if (!m) return null;
  const q = decodeURIComponent(m[1]);
  return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
}

const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

export default function FamilySosPage() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/emergency');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setAlert(data && data.status === 'active' ? data : null);
      } catch {
        // keep current state
      }
    };
    load();
    const id = setInterval(load, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const resolveAlert = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      await fetch('/api/emergency', { method: 'DELETE' });
    } catch {}
    setAlert(null);
    setResolving(false);
  };

  const embed = embedUrl(alert?.location);

  if (!alert) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold text-ink">SOS</h2>
          <p className="text-sm text-ink-muted">
            When grandma presses the SOS button or calls for help, the alert and her live location appear here.
          </p>
        </div>
        <div className="rounded-3xl border border-dashed border-line bg-card p-12 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-sage-soft text-sage">
            <CheckCircle2 size={30} />
          </div>
          <p className="text-sm font-bold text-ink">No active alerts</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink-muted">
            You&apos;ll see the emergency and grandma&apos;s location here the moment she triggers it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink">SOS</h2>
        <p className="text-sm text-ink-muted">An emergency alert is live right now.</p>
      </div>

      {/* Alert card */}
      <div
        role="alert"
        className="rounded-3xl bg-terra p-5 text-white shadow-lg"
        style={{ animation: 'alert-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-4 w-4 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full bg-white" />
            </span>
            <p className="text-sm font-extrabold uppercase tracking-wider">🚨 Emergency — {alert.sender_name}</p>
          </div>
          <button
            onClick={resolveAlert}
            disabled={resolving}
            className="shrink-0 rounded-full border border-white/40 px-4 py-1.5 text-xs font-bold transition-colors hover:bg-white/15 disabled:opacity-50"
          >
            {resolving ? 'Clearing…' : 'All clear ✓'}
          </button>
        </div>
        <p className="mt-2 text-base font-semibold">
          {alert.message}{alert.created_at ? ` · ${fmtTime(alert.created_at)}` : ''}
        </p>
        {!alert.location && (
          <p className="mt-2 text-xs text-white/75">
            No location available — the family code tracking needs location permission on grandma&apos;s device.
          </p>
        )}
      </div>

      {/* Location bubble */}
      {alert.location && (
        <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-soft">
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-terra-soft text-terra">
              <MapPin size={16} />
            </span>
            <p className="text-sm font-bold text-ink">Grandma&apos;s location</p>
            <a
              href={alert.location}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            >
              <ExternalLink size={13} /> Open in Google Maps
            </a>
          </div>
          {embed ? (
            <iframe
              title="Grandma's location"
              src={embed}
              className="h-64 w-full border-0"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <div className="flex h-40 items-center justify-center bg-card-soft text-sm text-ink-muted">
              Map preview unavailable — open the link above instead.
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes alert-in {
          from { opacity: 0; transform: translateY(-14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
