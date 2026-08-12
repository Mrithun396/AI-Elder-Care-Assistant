'use client';

import { TriangleAlert } from 'lucide-react';

// Hand-rolled SVG sparkline — no chart library needed, and it renders crisply
// at any width. One line + soft area fill + dots with hover titles.
export function LineChart({
  data,
  color,
  unit = '',
  height = 92,
  emptyLabel,
}: {
  data: { value: number; time?: string }[];
  color: string;
  unit?: string;
  height?: number;
  emptyLabel: string;
}) {
  const W = 320;
  const H = height;
  const P = 10;
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-muted">{emptyLabel}</p>;
  }
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${P},${H - P} ${line} ${x(data.length - 1).toFixed(1)},${H - P}`;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="trend">
        <polygon points={area} fill={color} opacity={0.12} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {vals.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} className="cursor-pointer">
            <title>
              {`${v}${unit ? ' ' + unit : ''}${data[i].time ? ' · ' + new Date(data[i].time!).toLocaleString() : ''}`}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-ink-muted">
        <span>{min}{unit ? ` ${unit}` : ''}</span>
        <span className="font-bold text-ink">{vals[vals.length - 1]}{unit ? ` ${unit}` : ''}</span>
        <span>{max}{unit ? ` ${unit}` : ''}</span>
      </div>
    </div>
  );
}

export type BpPoint = { sys: number; dia: number; time?: string };

// Blood pressure is two values — systolic + diastolic — so it gets two lines.
export function BpChart({
  data,
  emptyLabel,
  sysLabel = 'SYS',
  diaLabel = 'DIA',
}: {
  data: BpPoint[];
  emptyLabel: string;
  sysLabel?: string;
  diaLabel?: string;
}) {
  const W = 320;
  const H = 92;
  const P = 10;
  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-ink-muted">{emptyLabel}</p>;
  }
  const all = data.flatMap((d) => [d.sys, d.dia]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (data.length === 1 ? W / 2 : P + (i * (W - 2 * P)) / (data.length - 1));
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const line = (key: 'sys' | 'dia') =>
    data.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="blood pressure trend">
        <polyline
          points={line('sys')}
          fill="none"
          stroke="#C1502E"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={line('dia')}
          fill="none"
          stroke="#3B82F6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.sys)} r={3.5} fill="#C1502E">
              <title>{`sys ${d.sys}${d.time ? ' · ' + new Date(d.time).toLocaleString() : ''}`}</title>
            </circle>
            <circle cx={x(i)} cy={y(d.dia)} r={3.5} fill="#3B82F6">
              <title>{`dia ${d.dia}${d.time ? ' · ' + new Date(d.time).toLocaleString() : ''}`}</title>
            </circle>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-semibold tabular-nums text-ink-muted">
        <span>{min}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#C1502E]" />{sysLabel}</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3B82F6]" />{diaLabel}</span>
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// Small "needs attention" badge shown on flagged readings.
export function FlagBadge({ flagged, label = 'Needs attention' }: { flagged?: boolean; label?: string }) {
  if (!flagged) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-terra-soft px-2 py-0.5 text-[10px] font-bold text-terra">
      <TriangleAlert size={11} /> {label}
    </span>
  );
}
