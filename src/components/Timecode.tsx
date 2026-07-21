// SPDX-License-Identifier: AGPL-3.0-only

interface TimecodeProps {
  seconds: number;
  className?: string;
}

export function Timecode({ seconds, className = '' }: TimecodeProps) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds * 10) % 10);

  return (
    <span className={`font-mono tabular-nums ${className}`} aria-label={`${mins} minutes ${secs} seconds`}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}.{tenths}
    </span>
  );
}
