// SPDX-License-Identifier: AGPL-3.0-only

interface PaceChartProps {
  timeline: { time: number; wpm: number }[];
  targetMin: number;
  targetMax: number;
  pauses?: { start: number; duration: number }[];
  onSeek?: (time: number) => void;
}

export function PaceChart({ timeline, targetMin, targetMax, pauses = [], onSeek }: PaceChartProps) {
  if (timeline.length < 2) {
    return (
      <div className="panel p-4 text-center text-cream-dim text-sm">
        Not enough data for a pace chart.
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 45 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxTime = timeline[timeline.length - 1].time;
  const maxWpm = Math.max(200, ...timeline.map((t) => t.wpm));
  const minWpm = 0;

  const xScale = (t: number) => padding.left + (t / maxTime) * plotW;
  const yScale = (wpm: number) => padding.top + plotH - ((wpm - minWpm) / (maxWpm - minWpm)) * plotH;

  const linePath = timeline
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.time).toFixed(1)} ${yScale(p.wpm).toFixed(1)}`)
    .join(' ');

  // Target band shading
  const bandY1 = yScale(targetMax);
  const bandY2 = yScale(targetMin);

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const svgX = (x / rect.width) * width;
    const time = ((svgX - padding.left) / plotW) * maxTime;
    if (time >= 0 && time <= maxTime) onSeek(time);
  }

  return (
    <div className="panel p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto cursor-pointer"
        onClick={handleClick}
        role="img"
        aria-label="Pace chart showing words per minute over time"
      >
        {/* Target band */}
        <rect
          x={padding.left}
          y={bandY1}
          width={plotW}
          height={bandY2 - bandY1}
          fill="#4CC38A"
          opacity={0.08}
        />
        <line x1={padding.left} y1={bandY1} x2={padding.left + plotW} y2={bandY1} stroke="#4CC38A" strokeWidth={0.5} opacity={0.4} strokeDasharray="4 4" />
        <line x1={padding.left} y1={bandY2} x2={padding.left + plotW} y2={bandY2} stroke="#4CC38A" strokeWidth={0.5} opacity={0.4} strokeDasharray="4 4" />

        {/* Pause markers */}
        {pauses.map((p, i) => (
          <line key={i} x1={xScale(p.start)} y1={height - padding.bottom} x2={xScale(p.start)} y2={height - padding.bottom + 6} stroke="#F0A83C" strokeWidth={2} />
        ))}

        {/* Pace line */}
        <path d={linePath} fill="none" stroke="#F2E8D8" strokeWidth={1.5} />

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#3A3127" strokeWidth={1} />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#3A3127" strokeWidth={1} />

        {/* Y axis labels */}
        {[0, 50, 100, 150, 200].filter(v => v <= maxWpm).map((v) => (
          <text key={v} x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" className="fill-cream-dim" style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono' }}>{v}</text>
        ))}

        {/* X axis labels */}
        {[0, Math.floor(maxTime / 4), Math.floor(maxTime / 2), Math.floor(maxTime * 3 / 4), Math.floor(maxTime)].map((t) => (
          <text key={t} x={xScale(t)} y={height - 8} textAnchor="middle" className="fill-cream-dim" style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono' }}>{t}s</text>
        ))}

        {/* Labels */}
        <text x={padding.left + plotW / 2} y={height - 2} textAnchor="middle" className="fill-cream-dim" style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono' }}>TIME</text>
        <text x={8} y={padding.top + plotH / 2} textAnchor="middle" className="fill-cream-dim" style={{ fontSize: '9px', fontFamily: 'IBM Plex Mono' }} transform={`rotate(-90, 8, ${padding.top + plotH / 2})`}>WPM</text>
      </svg>
    </div>
  );
}
