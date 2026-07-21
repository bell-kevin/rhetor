// SPDX-License-Identifier: AGPL-3.0-only

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  detail?: string;
}

export function MetricCard({ label, value, unit, status = 'neutral', detail }: MetricCardProps) {
  const statusColor = {
    good: 'text-phosphor',
    warn: 'text-vu-amber',
    bad: 'text-tally',
    neutral: 'text-cream',
  }[status];

  return (
    <div className="panel p-4 flex flex-col gap-1">
      <span className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-2xl font-medium ${statusColor}`}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-cream-dim">{unit}</span>
        )}
      </div>
      {detail && (
        <span className="text-xs text-cream-dim mt-1">{detail}</span>
      )}
    </div>
  );
}
