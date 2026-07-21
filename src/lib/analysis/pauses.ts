// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pause detection from word timestamps.
 * - Silent pauses >= 1.5s are flagged
 * - Classified as intentional (after sentence-end punctuation) or mid-thought
 */

import type { WordTimestamp, PauseMark } from './types';

const PAUSE_THRESHOLD_S = 1.5;

/**
 * Detect long pauses between words.
 */
export function detectPauses(words: WordTimestamp[]): PauseMark[] {
  const pauses: PauseMark[] = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_THRESHOLD_S) {
      const prevText = words[i - 1].text;
      const intentional = /[.!?]$/.test(prevText);
      pauses.push({
        start: words[i - 1].end,
        end: words[i].start,
        duration: gap,
        intentional,
      });
    }
  }
  return pauses;
}

/**
 * Get inter-word gaps (all gaps, not just long ones). Used by hesitation detector.
 */
export function getInterWordGaps(words: WordTimestamp[]): Array<{ start: number; end: number; duration: number }> {
  const gaps: Array<{ start: number; end: number; duration: number }> = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 0.05) {
      gaps.push({
        start: words[i - 1].end,
        end: words[i].start,
        duration: gap,
      });
    }
  }
  return gaps;
}
