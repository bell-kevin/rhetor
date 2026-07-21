// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useRef } from 'react';

interface VUMeterProps {
  level: number; // dB, -60 to 0
  active: boolean;
}

export function VUMeter({ level, active }: VUMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Normalize level from -60..0 to 0..1
    const norm = Math.max(0, Math.min(1, (level + 60) / 60));
    const segments = 24;
    const segW = (w - (segments - 1) * 2) / segments;

    for (let i = 0; i < segments; i++) {
      const threshold = i / segments;
      const lit = active && norm > threshold;
      let color: string;
      if (i < 16) color = lit ? '#4CC38A' : '#1a2e22';
      else if (i < 20) color = lit ? '#F0A83C' : '#2e2518';
      else color = lit ? '#E5484D' : '#2e1a1a';

      const x = i * (segW + 2);
      ctx.fillStyle = color;
      ctx.fillRect(x, 0, segW, h);
    }
  }, [level, active]);

  return (
    <div className="w-full" role="meter" aria-label="Audio level" aria-valuenow={Math.round(level)} aria-valuemin={-60} aria-valuemax={0}>
      <canvas
        ref={canvasRef}
        width={480}
        height={24}
        className="w-full h-6 rounded"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
