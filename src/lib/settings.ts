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

export const SPEECH_MODEL_IDS = {
  tiny: 'onnx-community/whisper-tiny.en_timestamped',
  base: 'onnx-community/whisper-base.en_timestamped',
} as const;

const LEGACY_MODEL_IDS: Record<string, string> = {
  'onnx-community/whisper-tiny.en': SPEECH_MODEL_IDS.tiny,
  'onnx-community/whisper-base.en': SPEECH_MODEL_IDS.base,
};

export const DEFAULT_SETTINGS: AppSettings = {
  modelId: SPEECH_MODEL_IDS.tiny,
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
      const loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
      loaded.modelId = LEGACY_MODEL_IDS[loaded.modelId] ?? loaded.modelId;
      return loaded;
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
