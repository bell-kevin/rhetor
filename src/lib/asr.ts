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

type ProgressCallback = (p: ASRProgress) => void;

let worker: Worker | null = null;
let isLoaded = false;

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
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const handler = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'progress') {
        onProgress(payload);
      } else if (type === 'loaded') {
        isLoaded = true;
        w.removeEventListener('message', handler);
        resolve();
      } else if (type === 'error') {
        w.removeEventListener('message', handler);
        reject(new Error(payload));
      }
    };
    w.addEventListener('message', handler);
    w.postMessage({ type: 'load', payload: { modelId } });
  });
}

export function transcribe(audio: Float32Array): Promise<ASRResult> {
  return new Promise((resolve, reject) => {
    if (!isLoaded) {
      reject(new Error('Model not loaded'));
      return;
    }
    const w = getWorker();
    const handler = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'result') {
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
    w.postMessage({ type: 'transcribe', payload: { audio } });
  });
}

export function isModelLoaded(): boolean {
  return isLoaded;
}
