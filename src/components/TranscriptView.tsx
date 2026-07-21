// SPDX-License-Identifier: AGPL-3.0-only
import { useRef, useEffect, useCallback } from 'react';
import type { WordTimestamp, FillerMark, HedgeMark, PauseMark, HesitationMark } from '@/lib/db';

interface TranscriptViewProps {
  words: WordTimestamp[];
  fillers: FillerMark[];
  hedges: HedgeMark[];
  pauses: PauseMark[];
  hesitations: HesitationMark[];
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptView({ words, fillers, hedges, pauses, hesitations, currentTime, onSeek }: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build a set of filler word indices for quick lookup
  const fillerIndices = new Map<number, FillerMark>();
  for (const f of fillers) fillerIndices.set(f.index, f);

  const hedgeIndices = new Map<number, HedgeMark>();
  for (const h of hedges) hedgeIndices.set(h.index, h);

  // Find current word for karaoke highlight
  const currentWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  const handleWordClick = useCallback((start: number) => {
    onSeek(start);
  }, [onSeek]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIdx >= 0 && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-idx="${currentWordIdx}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentWordIdx]);

  // Insert pauses and hesitations inline
  const elements: Array<{ type: 'word'; idx: number } | { type: 'pause'; mark: PauseMark } | { type: 'hesitation'; mark: HesitationMark }> = [];

  let pauseIdx = 0;
  let hesIdx = 0;

  for (let i = 0; i < words.length; i++) {
    // Insert hesitations/pauses that occur before this word
    while (hesIdx < hesitations.length && hesitations[hesIdx].end <= words[i].start + 0.05) {
      elements.push({ type: 'hesitation', mark: hesitations[hesIdx] });
      hesIdx++;
    }
    while (pauseIdx < pauses.length && pauses[pauseIdx].end <= words[i].start + 0.05) {
      elements.push({ type: 'pause', mark: pauses[pauseIdx] });
      pauseIdx++;
    }
    elements.push({ type: 'word', idx: i });
  }

  return (
    <div ref={containerRef} className="panel p-6 max-h-[400px] overflow-y-auto leading-relaxed text-[15px]">
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {elements.map((el, i) => {
          if (el.type === 'pause') {
            const cls = el.mark.intentional ? 'bg-hairline text-cream-dim' : 'bg-vu-amber/20 text-vu-amber';
            return (
              <span
                key={`p-${i}`}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono mx-0.5 ${cls}`}
                onClick={() => onSeek(el.mark.start)}
              >
                ⏸ {el.mark.duration.toFixed(1)}s
              </span>
            );
          }
          if (el.type === 'hesitation') {
            return (
              <span
                key={`h-${i}`}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono mx-0.5 bg-tally/20 text-tally cursor-pointer"
                onClick={() => onSeek(el.mark.start)}
              >
                &lsaquo;um&rsaquo;
              </span>
            );
          }

          const word = words[el.idx];
          const filler = fillerIndices.get(el.idx);
          const hedge = hedgeIndices.get(el.idx);
          const isCurrent = el.idx === currentWordIdx;

          let className = 'cursor-pointer px-0.5 py-0.5 rounded transition-colors ';
          if (isCurrent) {
            className += 'bg-vu-amber/30 ';
          }
          if (filler) {
            className += filler.certain
              ? 'underline decoration-tally decoration-2 underline-offset-2 '
              : 'underline decoration-tally decoration-dotted decoration-2 underline-offset-2 ';
          } else if (hedge) {
            className += 'underline decoration-vu-amber decoration-2 underline-offset-2 ';
          }

          return (
            <span
              key={`w-${el.idx}`}
              data-idx={el.idx}
              className={className}
              onClick={() => handleWordClick(word.start)}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
