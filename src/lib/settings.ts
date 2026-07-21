// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Settings stored in localStorage.
 */

export interface AppSettings {
  modelId: string;
  targetWpmMin: number;
  targetWpmMax: number;
  fillerWords: string[];
  hedgePhrases: string[];
  defaultCapSeconds: number;
  micDeviceId: string;
}

const SETTINGS_KEY = 'rhetor-settings';

export const DEFAULT_SETTINGS: AppSettings = {
  modelId: 'onnx-community/whisper-tiny.en',
  targetWpmMin: 115,
  targetWpmMax: 160,
  fillerWords: [
    'um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know', 'i mean',
    'sort of', 'kind of', 'basically', 'actually', 'literally',
    'right', 'so', 'well', 'okay so',
  ],
  hedgePhrases: [
    'i think', 'i guess', 'i feel like', 'maybe', 'probably',
    'possibly', 'hopefully', 'just', 'a little bit', 'kind of a',
    "i'm not sure", 'i suppose',
  ],
  defaultCapSeconds: 150,
  micDeviceId: '',
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
