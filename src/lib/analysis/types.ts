// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Shared types for the analysis engine.
 */

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

export interface FillerMark {
  index: number;
  word: string;
  start: number;
  end: number;
  certain: boolean;
}

export interface PauseMark {
  start: number;
  end: number;
  duration: number;
  intentional: boolean;
}

export interface HesitationMark {
  start: number;
  end: number;
  duration: number;
}

export interface HedgeMark {
  index: number;
  phrase: string;
  start: number;
  end: number;
}

export interface PaceResult {
  medianWpm: number;
  inBand: boolean;
  timeline: { time: number; wpm: number }[];
  voicedDuration: number;
  totalWords: number;
}

export interface PitchResult {
  variety: number; // SD in semitones
  loudnessDynamics: number; // SD of frame RMS in dB
  medianF0: number;
}

export interface AnalysisConfig {
  targetWpmMin: number;
  targetWpmMax: number;
  fillerWords: string[];
  hedgePhrases: string[];
  targetSeconds: [number, number];
}

export const DEFAULT_FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know', 'i mean',
  'sort of', 'kind of', 'basically', 'actually', 'literally',
  'right', 'so', 'well', 'okay so',
];

export const DEFAULT_HEDGE_PHRASES = [
  'i think', 'i guess', 'i feel like', 'maybe', 'probably',
  'possibly', 'hopefully', 'just', 'a little bit', 'kind of a',
  "i'm not sure", 'i suppose',
];

export const DEFAULT_CONFIG: AnalysisConfig = {
  targetWpmMin: 115,
  targetWpmMax: 160,
  fillerWords: DEFAULT_FILLER_WORDS,
  hedgePhrases: DEFAULT_HEDGE_PHRASES,
  targetSeconds: [60, 120],
};
