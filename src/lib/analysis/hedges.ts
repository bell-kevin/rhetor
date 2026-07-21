// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Hedging language detection.
 * Phrase matching against a configurable list.
 * "just" is counted but weighted half in scoring.
 */

import type { WordTimestamp, HedgeMark } from './types';

/**
 * Detect hedging phrases in the transcript.
 */
export function detectHedges(
  words: WordTimestamp[],
  hedgePhrases: string[],
): HedgeMark[] {
  const results: HedgeMark[] = [];
  const texts = words.map((w) => w.text.toLowerCase().replace(/[.,!?;:]/g, ''));
  const usedIndices = new Set<number>();

  // Sort phrases by length descending to match longer ones first
  const sorted = [...hedgePhrases].sort((a, b) => b.split(' ').length - a.split(' ').length);

  for (const phrase of sorted) {
    const parts = phrase.split(' ');
    for (let i = 0; i <= texts.length - parts.length; i++) {
      if (usedIndices.has(i)) continue;
      let match = true;
      for (let j = 0; j < parts.length; j++) {
        if (texts[i + j] !== parts[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        results.push({
          index: i,
          phrase,
          start: words[i].start,
          end: words[i + parts.length - 1].end,
        });
        for (let j = 0; j < parts.length; j++) usedIndices.add(i + j);
      }
    }
  }

  results.sort((a, b) => a.start - b.start);
  return results;
}
