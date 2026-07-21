// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Composite delivery score (0-100) — a documented heuristic.
 *
 * Weights:
 *   Fillers + hesitations rate:  30%
 *   Pace in band:                20%
 *   Mid-thought pause discipline: 15%
 *   Vocal variety:               15%
 *   Hedging:                     10%
 *   Length fit:                   10%
 *
 * Each sub-metric maps to 0-100 with gentle sigmoid-like curves.
 * Never present as scientific — label "heuristic delivery score".
 */

import type { WordTimestamp, AnalysisConfig } from './types';
import type { SessionMetrics, AnalysisResult } from '@/lib/db';
import { detectFillers } from './fillers';
import { detectPauses } from './pauses';
import { analyzePace } from './pace';
import { detectHedges } from './hedges';
import { analyzePitch, detectHesitations } from './pitch';

/**
 * Smooth mapping: value at 0 → 100, decaying toward 0 as value grows.
 * rate: items per minute, halfLife: rate at which score drops to 50.
 */
function decayScore(rate: number, halfLife: number): number {
  return 100 * Math.exp(-0.693 * rate / halfLife);
}

/**
 * Bell-shaped score: peaks at center of band, drops off outside.
 */
function bandScore(value: number, min: number, max: number): number {
  const center = (min + max) / 2;
  const halfWidth = (max - min) / 2;
  if (value >= min && value <= max) return 100;
  const dist = value < min ? min - value : value - max;
  return Math.max(0, 100 - (dist / halfWidth) * 60);
}

/**
 * Vocal variety score: peaks around 2.5-4 semitones.
 */
function varietyScore(semitones: number): number {
  if (semitones >= 2 && semitones <= 4) return 100;
  if (semitones < 2) return Math.max(0, semitones / 2 * 100);
  // > 4 is still fine, gentle decay
  return Math.max(60, 100 - (semitones - 4) * 10);
}

/**
 * Generate coaching notes based on metrics.
 */
function generateCoachingNotes(
  fillerRate: number,
  hesitationCount: number,
  medianWpm: number,
  targetMin: number,
  targetMax: number,
  midThoughtPauses: number,
  variety: number,
  hedgeRate: number,
): string[] {
  const notes: string[] = [];

  if (fillerRate > 8) {
    notes.push(`${Math.round(fillerRate)} fillers per minute — when you feel one coming, pause silently instead. Silence reads as confidence.`);
  } else if (fillerRate > 4) {
    notes.push(`${Math.round(fillerRate)} fillers per minute — noticeable but manageable. Practice the silent pause: breathe where you'd say "um".`);
  }

  if (hesitationCount > 3) {
    notes.push(`Detected ${hesitationCount} hesitation sounds the transcript missed. These "uh" moments are normal — awareness is the first step to replacing them with silence.`);
  }

  if (medianWpm < targetMin) {
    notes.push(`Pace is ${Math.round(medianWpm)} WPM — slower than conversational. Try driving forward through your key points; varied pace is better than uniformly slow.`);
  } else if (medianWpm > targetMax) {
    notes.push(`Pace is ${Math.round(medianWpm)} WPM — faster than comfortable listening speed. Pause deliberately between ideas to let points land.`);
  }

  if (midThoughtPauses > 2) {
    notes.push(`${midThoughtPauses} mid-thought pauses over 1.5 seconds. If you lose your thread, bridge with "The key point is…" rather than going silent.`);
  }

  if (variety < 1.5) {
    notes.push(`Pitch variation ${variety.toFixed(1)} semitones — monotone range. Try emphasizing one key word per sentence with a pitch rise.`);
  }

  if (hedgeRate > 4) {
    notes.push(`High hedging rate (${Math.round(hedgeRate)}/min). Phrases like "I think" and "maybe" dilute authority. State your position, then qualify only if needed.`);
  }

  return notes.slice(0, 4);
}

/**
 * Run the full analysis pipeline on a transcript and audio.
 */
export function analyzeSession(
  words: WordTimestamp[],
  pcm: Float32Array,
  config: AnalysisConfig,
): AnalysisResult {
  const durationSeconds = words.length > 0 ? words[words.length - 1].end - words[0].start : 0;
  const durationMinutes = durationSeconds / 60;

  // 1. Fillers
  const fillers = detectFillers(words, config.fillerWords);
  const fillerCount = fillers.filter((f) => f.certain).length;
  const fillerRate = durationMinutes > 0 ? fillerCount / durationMinutes : 0;

  // 2. Pauses
  const pauses = detectPauses(words);
  const midThoughtPauses = pauses.filter((p) => !p.intentional);
  const longestPause = pauses.length > 0 ? Math.max(...pauses.map((p) => p.duration)) : 0;

  // 3. Pace
  const pace = analyzePace(words, config.targetWpmMin, config.targetWpmMax);

  // 4. Hedges
  const hedges = detectHedges(words, config.hedgePhrases);
  const hedgeCount = hedges.length;
  const hedgeRate = durationMinutes > 0 ? hedgeCount / durationMinutes : 0;

  // 5. Pitch & vocal variety
  const pitchResult = analyzePitch(pcm);

  // 6. Hesitations (filled pauses Whisper missed)
  const hesitations = detectHesitations(words, pcm);

  // 7. Length fit
  const [targetMin, targetMax] = config.targetSeconds;
  let lengthFit: 'under' | 'in-range' | 'over' = 'in-range';
  if (durationSeconds < targetMin) lengthFit = 'under';
  else if (durationSeconds > targetMax) lengthFit = 'over';

  // 8. Composite score
  const totalFillerRate = durationMinutes > 0 ? (fillerCount + hesitations.length) / durationMinutes : 0;
  const fillerScore = decayScore(totalFillerRate, 8); // 8/min → score 50
  const paceScore = bandScore(pace.medianWpm, config.targetWpmMin, config.targetWpmMax);
  const pauseScore = decayScore(midThoughtPauses.length, 4); // 4 pauses → score 50
  const varietyScoreVal = varietyScore(pitchResult.variety);
  const hedgeScore = decayScore(hedgeRate, 6); // 6/min → score 50
  const lengthScore = lengthFit === 'in-range' ? 100 : lengthFit === 'under' ? 40 : 50;

  const score = Math.round(
    fillerScore * 0.30 +
    paceScore * 0.20 +
    pauseScore * 0.15 +
    varietyScoreVal * 0.15 +
    hedgeScore * 0.10 +
    lengthScore * 0.10
  );

  // 9. Coaching notes
  const coachingNotes = generateCoachingNotes(
    fillerRate + (durationMinutes > 0 ? hesitations.length / durationMinutes : 0),
    hesitations.length,
    pace.medianWpm,
    config.targetWpmMin,
    config.targetWpmMax,
    midThoughtPauses.length,
    pitchResult.variety,
    hedgeRate,
  );

  const metrics: SessionMetrics = {
    score,
    fillerCount,
    fillerRate: Math.round(fillerRate * 10) / 10,
    hesitationCount: hesitations.length,
    paceMedian: pace.medianWpm,
    paceInBand: pace.inBand,
    longPauses: pauses.length,
    longestPause: Math.round(longestPause * 10) / 10,
    hedgeCount,
    hedgeRate: Math.round(hedgeRate * 10) / 10,
    vocalVariety: pitchResult.variety,
    loudnessDynamics: pitchResult.loudnessDynamics,
    lengthFit,
    durationSeconds: Math.round(durationSeconds),
  };

  return {
    metrics,
    fillers,
    pauses,
    hesitations,
    hedges,
    paceTimeline: pace.timeline,
    coachingNotes,
  };
}
