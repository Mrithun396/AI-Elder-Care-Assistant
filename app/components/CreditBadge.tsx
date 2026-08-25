'use client';
import { useCallback, useEffect, useState } from 'react';

export default function CreditBadge() {
  const [used, setUsed] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) return;
      const d = await res.json();
      if (!d.error && typeof d.used === 'number') setUsed(d.used);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (used === null) return null;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
      style={{
        background: '#000',
        color: '#fff',
        border: '2px solid #fff',
        boxShadow: '0 0 8px rgba(255,255,255,0.4), 0 0 16px rgba(255,255,255,0.15)',
        textShadow: '0 0 6px rgba(255,255,255,0.6)',
      }}
    >
      <span style={{ fontSize: 10 }}>⚡</span>
      <span>{used}</span>
    </div>
  );
}
