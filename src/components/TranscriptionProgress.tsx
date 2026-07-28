// SPDX-License-Identifier: AGPL-3.0-only

import { Timecode } from '@/components/Timecode';

export interface TranscriptionProgressProps {
  elapsedSeconds: number;
  estimatedTotalSeconds: number | null;
  completedChunks?: number;
  totalChunks?: number;
}

function formatRemaining(seconds: number): string {
  const rounded = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Timing details for the transcription stage.
 *
 * Chunk progress is optional because some ASR backends only report a final
 * result. When supplied, it is exposed as a determinate, accessible progress
 * bar without implying progress when the backend cannot measure it.
 */
export function TranscriptionProgress({
  elapsedSeconds,
  estimatedTotalSeconds,
  completedChunks,
  totalChunks,
}: TranscriptionProgressProps) {
  const safeElapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  const hasEstimate = estimatedTotalSeconds !== null
    && Number.isFinite(estimatedTotalSeconds)
    && estimatedTotalSeconds > 0;
  const remaining = hasEstimate
    ? Math.max(0, estimatedTotalSeconds - safeElapsed)
    : null;

  const hasChunkProgress = Number.isFinite(completedChunks)
    && Number.isFinite(totalChunks)
    && (totalChunks ?? 0) > 0;
  const safeTotalChunks = hasChunkProgress ? Math.max(1, Math.floor(totalChunks!)) : 0;
  const safeCompletedChunks = hasChunkProgress
    ? Math.min(safeTotalChunks, Math.max(0, Math.floor(completedChunks!)))
    : 0;
  const percent = hasChunkProgress
    ? Math.round((safeCompletedChunks / safeTotalChunks) * 100)
    : 0;

  return (
    <div className="w-full max-w-xs mx-auto space-y-3 font-mono">
      <dl className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-2 text-xs">
        <dt className="text-left uppercase tracking-widest text-cream-dim">Elapsed</dt>
        <dd className="text-right text-cream">
          <Timecode seconds={safeElapsed} />
        </dd>

        <dt className="text-left uppercase tracking-widest text-cream-dim">
          Estimated time left
        </dt>
        <dd className="text-right text-cream tabular-nums">
          {remaining === null
            ? 'Estimating…'
            : remaining > 0
              ? `About ${formatRemaining(remaining)}`
              : 'Finishing up…'}
        </dd>
      </dl>

      {hasChunkProgress && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] uppercase tracking-widest text-cream-dim">
            <span>Transcription progress</span>
            <span className="tabular-nums">{safeCompletedChunks}/{safeTotalChunks}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-hairline"
            role="progressbar"
            aria-label="Transcription progress"
            aria-valuemin={0}
            aria-valuemax={safeTotalChunks}
            aria-valuenow={safeCompletedChunks}
          >
            <div
              className="h-full rounded-full bg-vu-amber transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
