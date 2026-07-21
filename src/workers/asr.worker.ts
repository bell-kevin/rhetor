// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Web Worker running the Whisper ASR pipeline via transformers.js.
 * Communicates with the main thread via postMessage.
 */

import { pipeline, env } from '@huggingface/transformers';

// Disable local model check — always fetch from HF CDN
env.allowLocalModels = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'load') {
    const { modelId } = payload;
    try {
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      asr = await pipeline('automatic-speech-recognition', modelId, {
        device: device as 'webgpu' | 'wasm',
        dtype: 'q8' as unknown as undefined,
        progress_callback: (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
          self.postMessage({ type: 'progress', payload: progress });
        },
      });
      self.postMessage({ type: 'loaded' });
    } catch (err) {
      self.postMessage({ type: 'error', payload: String(err) });
    }
    return;
  }

  if (type === 'transcribe') {
    if (!asr) {
      self.postMessage({ type: 'error', payload: 'Model not loaded' });
      return;
    }
    try {
      const { audio } = payload as { audio: Float32Array };
      const result = await asr(audio, {
        return_timestamps: 'word',
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      self.postMessage({ type: 'result', payload: result });
    } catch {
      // Fallback: try segment timestamps
      try {
        const { audio } = payload as { audio: Float32Array };
        const result = await asr(audio, {
          return_timestamps: true,
          chunk_length_s: 30,
          stride_length_s: 5,
        });
        self.postMessage({ type: 'result', payload: { ...result, segmentLevel: true } });
      } catch (err2) {
        self.postMessage({ type: 'error', payload: String(err2) });
      }
    }
    return;
  }
};
