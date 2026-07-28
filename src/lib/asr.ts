// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Client interface to the ASR Web Worker.
 */

import type { WordTimestamp } from '@/lib/db';

export interface ASRProgress {
  status: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

export interface ASRResult {
  text: string;
  words: WordTimestamp[];
  segmentLevel: boolean;
}

export type ASRBackend = 'webgpu' | 'wasm';

export interface ASRTranscriptionProgress {
  attempt: number;
  audioSeconds: number;
  completedChunks: number;
  totalChunks: number;
  elapsedMs: number;
}

type ProgressCallback = (p: ASRProgress) => void;
type TranscriptionProgressCallback = (p: ASRTranscriptionProgress) => void;

let worker: Worker | null = null;
let loadedModelId: string | null = null;
let loadedBackend: ASRBackend | null = null;
let loadingModelId: string | null = null;
let loadingPromise: Promise<void> | null = null;
const loadProgressCallbacks = new Set<ProgressCallback>();
let nextRequestId = 1;

function createRequestId(): number {
  return nextRequestId++;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/asr.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export function loadModel(
  modelId: string,
  onProgress: ProgressCallback,
): Promise<void> {
  if (loadedModelId === modelId && loadedBackend) {
    onProgress({ status: 'ready', progress: 100 });
    return Promise.resolve();
  }

  if (loadingPromise) {
    if (loadingModelId !== modelId) {
      return loadingPromise
        .catch(() => undefined)
        .then(() => loadModel(modelId, onProgress));
    }

    loadProgressCallbacks.add(onProgress);
    return loadingPromise.finally(() => {
      loadProgressCallbacks.delete(onProgress);
    });
  }

  loadProgressCallbacks.add(onProgress);
  if (loadedModelId !== modelId) {
    loadedModelId = null;
    loadedBackend = null;
  }
  loadingModelId = modelId;
  const requestId = createRequestId();
  loadingPromise = new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (e: MessageEvent) => {
      const { type, payload, requestId: responseRequestId } = e.data;
      if (responseRequestId !== requestId) return;

      if (type === 'progress') {
        loadProgressCallbacks.forEach((callback) => callback(payload));
      } else if (type === 'loaded') {
        loadedModelId = payload?.modelId ?? modelId;
        loadedBackend = payload?.backend ?? null;
        loadProgressCallbacks.forEach((callback) => callback({
          status: 'ready',
          progress: 100,
        }));
        loadingModelId = null;
        loadingPromise = null;
        w.removeEventListener('message', handler);
        resolve();
      } else if (type === 'error') {
        loadedModelId = null;
        loadedBackend = null;
        loadingModelId = null;
        loadingPromise = null;
        w.removeEventListener('message', handler);
        reject(new Error(payload));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'load', payload: { modelId }, requestId });
  });

  return loadingPromise.finally(() => {
    loadProgressCallbacks.delete(onProgress);
  });
}

export function transcribe(
  audio: Float32Array,
  onProgress?: TranscriptionProgressCallback,
): Promise<ASRResult> {
  return new Promise((resolve, reject) => {
    if (!loadedModelId) {
      reject(new Error('Model not loaded'));
      return;
    }
    const w = getWorker();
    const requestId = createRequestId();
    const handler = (e: MessageEvent) => {
      const { type, payload, requestId: responseRequestId } = e.data;
      if (responseRequestId !== requestId) return;

      if (type === 'transcription-progress' || type === 'transcription-retry') {
        onProgress?.(payload);
      } else if (type === 'result') {
        w.removeEventListener('message', handler);
        const segmentLevel = payload.segmentLevel ?? false;
        const words: WordTimestamp[] = [];
        if (payload.chunks) {
          for (const chunk of payload.chunks) {
            const text = chunk.text?.trim();
            if (!text) continue;
            const [start, end] = chunk.timestamp;
            words.push({
              text,
              start: start ?? 0,
              end: end ?? start + 0.5,
            });
          }
        }
        resolve({ text: payload.text || '', words, segmentLevel });
      } else if (type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(payload));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'transcribe', payload: { audio }, requestId });
  });
}

export function isModelLoaded(modelId?: string): boolean {
  return loadedModelId !== null && (!modelId || loadedModelId === modelId);
}

export function getASRBackend(): ASRBackend | null {
  return loadedBackend;
}
