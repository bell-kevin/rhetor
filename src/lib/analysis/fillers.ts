// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Filler word detection with context rules to reduce false positives.
 *
 * Rules:
 * - "so", "well", "okay so": only count at sentence start or after pause >= 0.6s
 * - "like": only count when NOT preceded by a verb of preference/comparison
 * - Ambiguous hits are marked certain: false
 */

import type { WordTimestamp, FillerMark } from './types';

const CONTEXT_FILLERS = new Set(['so', 'well', 'okay so']);
const LIKE_EXCLUSION_VERBS = new Set([
  'feel', 'felt', 'look', 'looks', 'seem', 'seems', 'sound', 'sounds',
  'would', "i'd", 'was', 'is', 'be', 'something', 'things',
]);

// Multi-word fillers that need joining
const MULTI_WORD_FILLERS = ['you know', 'i mean', 'sort of', 'kind of', 'okay so'];

/**
 * Detect filler words in a word-timestamp array.
 */
export function detectFillers(
  words: WordTimestamp[],
  fillerList: string[],
): FillerMark[] {
  const results: FillerMark[] = [];
  const singleFillers = fillerList.filter((f) => !f.includes(' '));
  const multiFillers = fillerList.filter((f) => f.includes(' '));

  // Build a joined text array for multi-word matching
  const texts = words.map((w) => w.text.toLowerCase().replace(/[.,!?;:]/g, ''));

  // Check multi-word fillers first
  const usedIndices = new Set<number>();
  for (const filler of multiFillers) {
    const parts = filler.split(' ');
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
        const certain = evaluateContext(filler, words, i, texts);
        results.push({
          index: i,
          word: filler,
          start: words[i].start,
          end: words[i + parts.length - 1].end,
          certain,
        });
        for (let j = 0; j < parts.length; j++) usedIndices.add(i + j);
      }
    }
  }

  // Check single-word fillers
  for (let i = 0; i < texts.length; i++) {
    if (usedIndices.has(i)) continue;
    const word = texts[i];
    if (singleFillers.includes(word)) {
      const certain = evaluateContext(word, words, i, texts);
      results.push({
        index: i,
        word,
        start: words[i].start,
        end: words[i].end,
        certain,
      });
    }
  }

  results.sort((a, b) => a.start - b.start);
  return results;
}

function evaluateContext(
  filler: string,
  words: WordTimestamp[],
  index: number,
  texts: string[],
): boolean {
  // Context-dependent fillers: only count at sentence start or after pause >= 0.6s
  if (CONTEXT_FILLERS.has(filler)) {
    if (index === 0) return true;
    const gap = words[index].start - words[index - 1].end;
    if (gap >= 0.6) return true;
    const prevText = words[index - 1].text;
    if (/[.!?]$/.test(prevText)) return true;
    return false; // Mark as uncertain — we still include it but certain: false
  }

  // "like": exclude when preceded by preference/comparison verb
  if (filler === 'like') {
    if (index > 0 && LIKE_EXCLUSION_VERBS.has(texts[index - 1])) {
      return false; // Ambiguous
    }
    return true;
  }

  return true;
}
