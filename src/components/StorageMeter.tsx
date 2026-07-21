// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect } from 'react';

interface StorageMeterProps {
  className?: string;
}

export function StorageMeter({ className = '' }: StorageMeterProps) {
  const [usage, setUsage] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then((est) => {
        setUsage({
          used: est.usage || 0,
          total: est.quota || 0,
        });
      });
    }
  }, []);

  if (!usage) return null;

  const usedMB = (usage.used / 1024 / 1024).toFixed(1);
  const percent = usage.total > 0 ? (usage.used / usage.total) * 100 : 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs font-mono text-cream-dim">
        <span>Storage: {usedMB} MB used</span>
        <span>{percent.toFixed(0)}%</span>
      </div>
      <div className="w-full h-1.5 bg-hairline rounded-full overflow-hidden">
        <div
          className="h-full bg-vu-amber rounded-full"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-cream-dim">Audio recordings are the largest part of stored data.</p>
    </div>
  );
}
