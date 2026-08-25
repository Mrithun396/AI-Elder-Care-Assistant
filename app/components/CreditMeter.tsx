'use client';
import { useCallback, useEffect, useState } from 'react';
import { Zap } from 'lucide-react';

type CreditData = {
  balance: number;
  used: number;
  remaining: number;
  total: number;
  byType: Record<string, { count: number; cost: number }>;
};

export default function CreditMeter() {
  const [data, setData] = useState<CreditData | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) return;
      const d = await res.json();
      if (!d.error) setData(d);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const isLow = data.remaining < 10;
  const isCritical = data.remaining < 3;

  return (
    <div
      className={`flex items-center gap-4 rounded-full border px-5 py-3 shadow-soft ${
        isCritical
          ? 'border-terra/40 bg-terra-soft'
          : isLow
          ? 'border-accent/30 bg-accent-soft'
          : 'border-line bg-card'
      }`}
    >
      {/* Circular icon badge */}
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          isCritical ? 'bg-terra/15 text-terra' : isLow ? 'bg-accent/15 text-accent' : 'bg-brand-soft text-brand'
        }`}
      >
        <Zap size={20} />
      </div>

      {/* Credit count */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-ink">{data.used}</span>
          <span className="text-sm font-semibold text-ink-muted">/ {data.total}</span>
          <span className="ml-1 text-xs text-ink-muted">credits</span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-muted">
          {data.remaining} remaining
          {isCritical && ' — running out!'}
          {isLow && !isCritical && ' — getting low'}
        </p>
      </div>

      {/* Status dot */}
      <div
        className={`h-3 w-3 shrink-0 rounded-full ${
          isCritical ? 'bg-terra animate-pulse' : isLow ? 'bg-accent' : 'bg-sage'
        }`}
      />
    </div>
  );
}
