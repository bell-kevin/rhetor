// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Vocal variety analysis: pitch tracking and loudness dynamics.
 *
 * F0 estimation via autocorrelation on 40ms frames, 10ms hop.
 * Search range: 60-400 Hz.
 * Voiced/unvoiced decision by energy + autocorrelation peak clarity.
 * Variety = SD of F0 in semitones relative to speaker median.
 * Also computes loudness dynamics (SD of frame RMS in dB).
 *
 * Additionally provides the filled-pause (hesitation) detector:
 * finds voiced gaps between words that Whisper may have dropped.
 */

import type { WordTimestamp, HesitationMark, PitchResult } from './types';
import { getInterWordGaps } from './pauses';

// DSP constants
const FRAME_SIZE_S = 0.04; // 40ms frames for pitch
const HOP_SIZE_S = 0.01;   // 10ms hop
const MIN_F0 = 60;
const MAX_F0 = 400;
const SAMPLE_RATE = 16000;

// Hesitation detector constants
const HESITATION_GAP_THRESHOLD_S = 0.35;   // Minimum gap to check
const HESITATION_VOICED_MIN_S = 0.2;       // Minimum voiced duration within gap
const HESITATION_FRAME_S = 0.025;          // 25ms frames for RMS
const HESITATION_HOP_S = 0.01;            // 10ms hop
const PITCH_SEMITONE_RANGE = 1.5;          // Near-flat pitch threshold

/**
 * Estimate noise floor from the quietest decile of frame energies.
 */
function estimateNoiseFloor(pcm: Float32Array): number {
  const frameLen = Math.floor(HESITATION_FRAME_S * SAMPLE_RATE);
  const hop = Math.floor(HESITATION_HOP_S * SAMPLE_RATE);
  const rmsValues: number[] = [];

  for (let i = 0; i + frameLen <= pcm.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + frameLen; j++) {
      sum += pcm[j] * pcm[j];
    }
    rmsValues.push(Math.sqrt(sum / frameLen));
  }

  rmsValues.sort((a, b) => a - b);
  // Quietest decile
  const decileIdx = Math.floor(rmsValues.length * 0.1);
  return rmsValues[decileIdx] || 0.001;
}

/**
 * Compute RMS for a segment of audio.
 */
function segmentRMS(pcm: Float32Array, startSample: number, endSample: number): number {
  const start = Math.max(0, Math.floor(startSample));
  const end = Math.min(pcm.length, Math.floor(endSample));
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) {
    sum += pcm[i] * pcm[i];
  }
  return Math.sqrt(sum / (end - start));
}

/**
 * Simple autocorrelation-based F0 estimation for a single frame.
 * Returns 0 if unvoiced.
 */
function estimateF0Frame(frame: Float32Array): number {
  const n = frame.length;
  const minLag = Math.floor(SAMPLE_RATE / MAX_F0);
  const maxLag = Math.floor(SAMPLE_RATE / MIN_F0);

  // Frame energy check — if too quiet, unvoiced
  let energy = 0;
  for (let i = 0; i < n; i++) energy += frame[i] * frame[i];
  if (energy / n < 1e-6) return 0;

  // Normalized autocorrelation
  let bestLag = 0;
  let bestCorr = 0;

  for (let lag = minLag; lag <= Math.min(maxLag, n - 1); lag++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < n - lag; i++) {
      corr += frame[i] * frame[i + lag];
      norm1 += frame[i] * frame[i];
      norm2 += frame[i + lag] * frame[i + lag];
    }
    const denom = Math.sqrt(norm1 * norm2);
    if (denom === 0) continue;
    const normCorr = corr / denom;
    if (normCorr > bestCorr) {
      bestCorr = normCorr;
      bestLag = lag;
    }
  }

  // Clarity threshold — must be well-correlated to be voiced
  if (bestCorr < 0.4 || bestLag === 0) return 0;
  return SAMPLE_RATE / bestLag;
}

/**
 * Analyze vocal variety (pitch and loudness).
 */
export function analyzePitch(pcm: Float32Array): PitchResult {
  const frameLen = Math.floor(FRAME_SIZE_S * SAMPLE_RATE);
  const hop = Math.floor(HOP_SIZE_S * SAMPLE_RATE);

  const f0Values: number[] = [];
  const rmsDbValues: number[] = [];

  for (let i = 0; i + frameLen <= pcm.length; i += hop) {
    const frame = pcm.slice(i, i + frameLen);

    // Pitch
    const f0 = estimateF0Frame(frame);
    if (f0 > 0) f0Values.push(f0);

    // Loudness (RMS in dB)
    let sum = 0;
    for (let j = 0; j < frame.length; j++) sum += frame[j] * frame[j];
    const rms = Math.sqrt(sum / frame.length);
    if (rms > 0) rmsDbValues.push(20 * Math.log10(rms));
  }

  if (f0Values.length < 5) {
    return { variety: 0, loudnessDynamics: 0, medianF0: 0 };
  }

  // Median F0
  const sortedF0 = [...f0Values].sort((a, b) => a - b);
  const medianF0 = sortedF0[Math.floor(sortedF0.length / 2)];

  // Convert to semitones relative to median, compute SD
  const semitones = f0Values.map((f) => 12 * Math.log2(f / medianF0));
  const mean = semitones.reduce((s, v) => s + v, 0) / semitones.length;
  const variance = semitones.reduce((s, v) => s + (v - mean) ** 2, 0) / semitones.length;
  const variety = Math.sqrt(variance);

  // Loudness dynamics: SD of RMS in dB
  let loudnessDynamics = 0;
  if (rmsDbValues.length > 0) {
    const meanDb = rmsDbValues.reduce((s, v) => s + v, 0) / rmsDbValues.length;
    const varDb = rmsDbValues.reduce((s, v) => s + (v - meanDb) ** 2, 0) / rmsDbValues.length;
    loudnessDynamics = Math.sqrt(varDb);
  }

  return {
    variety: Math.round(variety * 10) / 10,
    loudnessDynamics: Math.round(loudnessDynamics * 10) / 10,
    medianF0: Math.round(medianF0),
  };
}

/**
 * Detect filled pauses (hesitations) that Whisper may have dropped.
 * Looks in inter-word gaps >= 0.35s for voiced segments with near-flat pitch.
 */
export function detectHesitations(
  words: WordTimestamp[],
  pcm: Float32Array,
): HesitationMark[] {
  const hesitations: HesitationMark[] = [];
  const noiseFloor = estimateNoiseFloor(pcm);
  const gaps = getInterWordGaps(words);

  for (const gap of gaps) {
    if (gap.duration < HESITATION_GAP_THRESHOLD_S) continue;

    const startSample = Math.floor(gap.start * SAMPLE_RATE);
    const endSample = Math.floor(gap.end * SAMPLE_RATE);

    // Count frames above noise floor
    const frameLen = Math.floor(HESITATION_FRAME_S * SAMPLE_RATE);
    const hop = Math.floor(HESITATION_HOP_S * SAMPLE_RATE);
    let voicedFrames = 0;
    let totalFrames = 0;
    const pitchValues: number[] = [];

    for (let i = startSample; i + frameLen <= endSample; i += hop) {
      totalFrames++;
      const rms = segmentRMS(pcm, i, i + frameLen);
      if (rms > noiseFloor * 2) {
        voicedFrames++;
        // Quick pitch check on voiced frames
        const frame = pcm.slice(i, i + frameLen);
        const f0 = estimateF0Frame(frame);
        if (f0 > 0) pitchValues.push(f0);
      }
    }

    const voicedDuration = voicedFrames * HESITATION_HOP_S;
    if (voicedDuration < HESITATION_VOICED_MIN_S) continue;

    // Check for near-flat pitch (range within ±1.5 semitones)
    if (pitchValues.length >= 2) {
      const sortedPitch = [...pitchValues].sort((a, b) => a - b);
      const medPitch = sortedPitch[Math.floor(sortedPitch.length / 2)];
      const semitones = pitchValues.map((f) => 12 * Math.log2(f / medPitch));
      const maxDev = Math.max(...semitones.map(Math.abs));
      if (maxDev > PITCH_SEMITONE_RANGE) continue;
    }

    hesitations.push({
      start: gap.start,
      end: gap.end,
      duration: gap.duration,
    });
  }

  return hesitations;
}
