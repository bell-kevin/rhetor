// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Local transcription timing estimates.
 *
 * Performance is represented as a real-time factor: transcription wall time
 * divided by audio duration. A bounded exponential moving average adapts the
 * estimate to this browser without sending performance data anywhere.
 */

const STORAGE_KEY = 'rhetor-transcription-timing-v1';
const STORAGE_VERSION = 1;
const EMA_ALPHA = 0.3;
const ESTIMATE_HEADROOM = 1.1;
const MIN_ESTIMATE_SECONDS = 3;
const MIN_REAL_TIME_FACTOR = 0.05;
const MAX_REAL_TIME_FACTOR = 20;
const MAX_AUDIO_SECONDS = 6 * 60 * 60;
const MAX_PROFILES = 16;

interface TimingProfile {
  realTimeFactor: number;
  samples: number;
  updatedAt: number;
}

interface StoredTimingProfiles {
  version: number;
  profiles: Record<string, TimingProfile>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeBackend(backend: string): string {
  const normalized = backend.trim().toLowerCase();
  if (normalized.includes('webgpu') || normalized === 'gpu') return 'webgpu';
  if (normalized.includes('wasm') || normalized.includes('cpu')) return 'wasm';
  return normalized || 'unknown';
}

function profileKey(modelId: string, backend: string): string {
  return `${normalizeBackend(backend)}:${modelId.trim().toLowerCase() || 'unknown'}`;
}

/**
 * Conservative cold-start factors. These intentionally favor a slightly long
 * ETA until this browser has enough completed runs to calibrate itself.
 */
function defaultRealTimeFactor(modelId: string, backend: string): number {
  const isTiny = modelId.toLowerCase().includes('tiny');
  const isBase = modelId.toLowerCase().includes('base');

  if (normalizeBackend(backend) === 'webgpu') {
    if (isTiny) return 0.6;
    if (isBase) return 1;
    return 1.25;
  }

  if (isTiny) return 2;
  if (isBase) return 3.5;
  return 4;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isTimingProfile(value: unknown): value is TimingProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<TimingProfile>;
  return Number.isFinite(profile.realTimeFactor)
    && profile.realTimeFactor! >= MIN_REAL_TIME_FACTOR
    && profile.realTimeFactor! <= MAX_REAL_TIME_FACTOR
    && Number.isFinite(profile.samples)
    && profile.samples! >= 0
    && Number.isFinite(profile.updatedAt);
}

function readProfiles(): Record<string, TimingProfile> {
  const storage = getStorage();
  if (!storage) return {};

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<StoredTimingProfiles>;
    if (parsed.version !== STORAGE_VERSION || !parsed.profiles || typeof parsed.profiles !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed.profiles).filter((entry): entry is [string, TimingProfile] => (
        isTimingProfile(entry[1])
      )),
    );
  } catch {
    return {};
  }
}

function writeProfiles(profiles: Record<string, TimingProfile>): void {
  const storage = getStorage();
  if (!storage) return;

  const boundedProfiles = Object.fromEntries(
    Object.entries(profiles)
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_PROFILES),
  );

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      profiles: boundedProfiles,
    } satisfies StoredTimingProfiles));
  } catch {
    // Estimation is best-effort; private browsing and full storage may reject writes.
  }
}

/**
 * Estimate total transcription wall time for an audio clip.
 */
export function getEstimatedTranscriptionSeconds(
  audioSeconds: number,
  modelId: string,
  backend: string,
): number {
  if (!Number.isFinite(audioSeconds) || audioSeconds <= 0) return 0;

  const safeAudioSeconds = Math.min(audioSeconds, MAX_AUDIO_SECONDS);
  const profile = readProfiles()[profileKey(modelId, backend)];
  const realTimeFactor = profile?.realTimeFactor
    ?? defaultRealTimeFactor(modelId, backend);

  return Math.ceil(Math.max(
    MIN_ESTIMATE_SECONDS,
    safeAudioSeconds * realTimeFactor * ESTIMATE_HEADROOM,
  ));
}

/**
 * Add one completed run to the local, bounded performance average.
 */
export function recordTranscriptionPerformance(
  audioSeconds: number,
  transcriptionSeconds: number,
  modelId: string,
  backend: string,
): void {
  if (
    !Number.isFinite(audioSeconds)
    || audioSeconds <= 0
    || !Number.isFinite(transcriptionSeconds)
    || transcriptionSeconds <= 0
  ) {
    return;
  }

  const key = profileKey(modelId, backend);
  const profiles = readProfiles();
  const previous = profiles[key];
  const startingFactor = previous?.realTimeFactor
    ?? defaultRealTimeFactor(modelId, backend);
  const observedFactor = clamp(
    transcriptionSeconds / Math.min(audioSeconds, MAX_AUDIO_SECONDS),
    MIN_REAL_TIME_FACTOR,
    MAX_REAL_TIME_FACTOR,
  );
  const nextFactor = clamp(
    startingFactor * (1 - EMA_ALPHA) + observedFactor * EMA_ALPHA,
    MIN_REAL_TIME_FACTOR,
    MAX_REAL_TIME_FACTOR,
  );

  profiles[key] = {
    realTimeFactor: nextFactor,
    samples: Math.min((previous?.samples ?? 0) + 1, Number.MAX_SAFE_INTEGER),
    updatedAt: Date.now(),
  };
  writeProfiles(profiles);
}

/**
 * Blend the prior clip estimate with observed chunk throughput.
 *
 * Early chunks only nudge the prior; as progress approaches completion, the
 * measured throughput becomes the dominant estimate.
 */
export function blendLiveEstimate(
  priorTotal: number,
  elapsed: number,
  completed: number,
  total: number,
): number {
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const safePrior = Number.isFinite(priorTotal) && priorTotal > 0
    ? Math.max(priorTotal, safeElapsed)
    : safeElapsed;

  if (
    !Number.isFinite(completed)
    || !Number.isFinite(total)
    || completed <= 0
    || total <= 0
  ) {
    return safePrior;
  }

  const progress = clamp(completed / total, 0, 1);
  if (progress >= 1) return safeElapsed;

  const observedTotal = safeElapsed > 0
    ? safeElapsed / progress
    : safePrior;
  const blended = safePrior * (1 - progress) + observedTotal * progress;
  return Math.max(safeElapsed, blended);
}
