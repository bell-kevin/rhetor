// SPDX-License-Identifier: AGPL-3.0-only
import type { Session } from '@/lib/db';

interface TrendChartProps {
  sessions: Session[];
  metric: 'fillerRate' | 'pace' | 'variety';
  targetMin?: number;
  targetMax?: number;
}

export function TrendChart({ sessions, metric, targetMin, targetMax }: TrendChartProps) {
  if (sessions.length < 2) {
    return (
      <div className="panel p-4 text-center text-cream-dim text-sm">
        Need at least 2 sessions to show trends.
      </div>
    );
  }

  const sorted = [...sessions].sort((a, b) => a.createdAt - b.createdAt);
  const values = sorted.map((s) => {
    if (metric === 'fillerRate') return s.analysis.metrics.fillerRate + (s.analysis.metrics.hesitationCount / Math.max(s.analysis.metrics.durationSeconds / 60, 0.1));
    if (metric === 'pace') return s.analysis.metrics.paceMedian;
    return s.analysis.metrics.vocalVariety;
  });

  const width = 500;
  const height = 150;
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...values, targetMax || 0) * 1.1;
  const minVal = Math.min(0, ...values);

  const xScale = (i: number) => padding.left + (i / (values.length - 1)) * plotW;
  const yScale = (v: number) => padding.top + plotH - ((v - minVal) / (maxVal - minVal)) * plotH;

  const linePath = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`)
    .join(' ');

  const labels = { fillerRate: 'FILLERS + HESITATIONS / MIN', pace: 'WPM', variety: 'SEMITONES' };

  return (
    <div className="panel p-4">
      <div className="font-mono text-[10px] tracking-widest uppercase text-cream-dim mb-2">
        {labels[metric]}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Target band */}
        {targetMin !== undefined && targetMax !== undefined && (
          <rect
            x={padding.left}
            y={yScale(targetMax)}
            width={plotW}
            height={yScale(targetMin) - yScale(targetMax)}
            fill="#4CC38A"
            opacity={0.08}
          />
        )}

        {/* Line */}
        <path d={linePath} fill="none" stroke="#F2E8D8" strokeWidth={1.5} />

        {/* Dots */}
        {values.map((v, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(v)} r={3} fill="#F0A83C" />
        ))}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#3A3127" strokeWidth={1} />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#3A3127" strokeWidth={1} />

        {/* Y labels */}
        {[minVal, (minVal + maxVal) / 2, maxVal].map((v) => (
          <text key={v} x={padding.left - 6} y={yScale(v) + 3} textAnchor="end" style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', fill: '#B7AA96' }}>
            {Math.round(v)}
          </text>
        ))}

        {/* Session count */}
        <text x={padding.left + plotW / 2} y={height - 4} textAnchor="middle" style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono', fill: '#B7AA96' }}>
          {values.length} SESSIONS
        </text>
      </svg>
    </div>
  );
}
