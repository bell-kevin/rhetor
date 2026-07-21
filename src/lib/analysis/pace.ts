// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Speaking pace analysis.
 * - Words per minute = spoken words / voiced duration
 * - Rolling WPM over a 10-second sliding window
 * - Voiced duration excludes silent pauses >= 1.5s
 */

import type { WordTimestamp, PaceResult } from './types';

const WINDOW_S = 10;
const LONG_PAUSE_S = 1.5;

/**
 * Calculate speaking pace metrics.
 */
export function analyzePace(
  words: WordTimestamp[],
  targetMin: number,
  targetMax: number,
): PaceResult {
  if (words.length === 0) {
    return { medianWpm: 0, inBand: false, timeline: [], voicedDuration: 0, totalWords: 0 };
  }

  const totalStart = words[0].start;
  const totalEnd = words[words.length - 1].end;
  const totalDuration = totalEnd - totalStart;

  // Calculate voiced duration by subtracting long pauses
  let pauseTime = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= LONG_PAUSE_S) {
      pauseTime += gap;
    }
  }
  const voicedDuration = Math.max(totalDuration - pauseTime, 1);

  const totalWords = words.length;
  const overallWpm = (totalWords / voicedDuration) * 60;

  // Rolling WPM over 10s windows
  const timeline: { time: number; wpm: number }[] = [];
  const step = 1; // 1 second steps
  for (let t = totalStart; t + WINDOW_S <= totalEnd; t += step) {
    const windowEnd = t + WINDOW_S;
    let count = 0;
    let windowPause = 0;

    for (let i = 0; i < words.length; i++) {
      const mid = (words[i].start + words[i].end) / 2;
      if (mid >= t && mid < windowEnd) count++;
      // Pause time within this window
      if (i > 0) {
        const gapStart = Math.max(words[i - 1].end, t);
        const gapEnd = Math.min(words[i].start, windowEnd);
        if (gapEnd > gapStart && words[i].start - words[i - 1].end >= LONG_PAUSE_S) {
          windowPause += gapEnd - gapStart;
        }
      }
    }

    const windowVoiced = Math.max(WINDOW_S - windowPause, 1);
    const wpm = (count / windowVoiced) * 60;
    timeline.push({ time: t - totalStart, wpm });
  }

  // Median WPM from the timeline, or overall if timeline is empty
  let medianWpm = overallWpm;
  if (timeline.length > 0) {
    const sorted = [...timeline.map((t) => t.wpm)].sort((a, b) => a - b);
    medianWpm = sorted[Math.floor(sorted.length / 2)];
  }

  return {
    medianWpm: Math.round(medianWpm),
    inBand: medianWpm >= targetMin && medianWpm <= targetMax,
    timeline,
    voicedDuration,
    totalWords,
  };
}
