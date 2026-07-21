// SPDX-License-Identifier: AGPL-3.0-only

interface TallyLampProps {
  active: boolean;
  label?: string;
}

export function TallyLamp({ active, label = 'REC' }: TallyLampProps) {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div
        className={`w-3 h-3 rounded-full transition-colors ${
          active
            ? 'bg-tally shadow-[0_0_8px_rgba(229,72,77,0.6)] animate-pulse motion-reduce:animate-none'
            : 'bg-hairline'
        }`}
        style={active ? { animationDuration: '1.2s' } : undefined}
      />
      <span className="font-mono text-xs tracking-widest uppercase text-cream-dim">
        {active ? label : 'STANDBY'}
      </span>
      <span className="sr-only">{active ? `Recording, ${label}` : 'Standby'}</span>
    </div>
  );
}
