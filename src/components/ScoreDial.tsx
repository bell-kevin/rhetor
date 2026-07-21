// SPDX-License-Identifier: AGPL-3.0-only

interface ScoreDialProps {
  score: number; // 0-100
  size?: number;
}

export function ScoreDial({ score, size = 160 }: ScoreDialProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference * 0.75; // 270 degree arc

  const color = score >= 75 ? '#4CC38A' : score >= 50 ? '#F0A83C' : '#E5484D';

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 transform -rotate-[135deg]">
        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#3A3127"
          strokeWidth={8}
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="font-mono text-3xl font-medium text-cream">{score}</span>
        <span
          className="font-mono text-[9px] tracking-widest uppercase text-cream-dim"
          title="Heuristic delivery score based on fillers, pace, pauses, vocal variety, hedging, and length"
        >
          SCORE
        </span>
      </div>
    </div>
  );
}
