'use client';
import { useCallback, useEffect, useState } from 'react';
import { Zap, MessageCircle, Volume2, Languages, Mic } from 'lucide-react';

type CreditData = {
  balance: number;
  used: number;
  remaining: number;
  total: number;
  byType: Record<string, { count: number; cost: number }>;
};

const TYPE_META: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  chat: { label: 'AI Chat', icon: MessageCircle, color: 'text-brand' },
  tts: { label: 'Voice', icon: Volume2, color: 'text-accent' },
  stt: { label: 'Listen', icon: Mic, color: 'text-sage' },
  translate: { label: 'Translate', icon: Languages, color: 'text-terra' },
};

export default function CreditMeter() {
  const [data, setData] = useState<CreditData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/credits');
      if (!res.ok) throw new Error('Failed to load');
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setError('');
    } catch {
      setError('Could not load credit data');
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, [load]);

  if (error) return null; // don't show if table doesn't exist yet
  if (!data) return null;

  const pct = data.total > 0 ? Math.max(0, Math.min(100, (data.used / data.total) * 100)) : 0;
  const isLow = data.remaining < 10;
  const isCritical = data.remaining < 3;

  return (
    <div className="rounded-3xl border border-line bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2">
        <Zap size={18} className={isCritical ? 'text-terra' : isLow ? 'text-accent' : 'text-brand'} />
        <h3 className="text-sm font-bold text-ink">AI Credits</h3>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
          isCritical ? 'bg-terra-soft text-terra' : isLow ? 'bg-accent-soft text-accent' : 'bg-sage-soft text-sage'
        }`}>
          {isCritical ? 'Low!' : isLow ? 'Running low' : 'Active'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between text-xs text-ink-muted">
          <span>{data.used} used</span>
          <span>{data.remaining} remaining</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-card-soft">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCritical ? 'bg-terra' : isLow ? 'bg-accent' : 'bg-brand'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1 text-right text-[10px] text-ink-muted">
          {Math.round(pct)}% of {data.total} credits
        </p>
      </div>

      {/* Breakdown by type */}
      {Object.keys(data.byType).length > 0 && (
        <div className="space-y-1.5">
          {Object.entries(data.byType)
            .sort((a, b) => b[1].cost - a[1].cost)
            .map(([type, info]) => {
              const meta = TYPE_META[type] || { label: type, icon: Zap, color: 'text-ink-muted' };
              const Icon = meta.icon;
              return (
                <div key={type} className="flex items-center gap-2.5 rounded-2xl bg-card-soft px-3 py-2">
                  <Icon size={14} className={meta.color} />
                  <span className="flex-1 text-xs font-semibold text-ink">{meta.label}</span>
                  <span className="text-[11px] text-ink-muted">{info.count} calls</span>
                  <span className="min-w-[3rem] text-right text-[11px] font-bold text-ink">
                    {info.cost.toFixed(1)}
                  </span>
                </div>
              );
            })}
        </div>
      )}

      {Object.keys(data.byType).length === 0 && (
        <p className="text-xs text-ink-muted">No credits used yet — start chatting!</p>
      )}
    </div>
  );
}
