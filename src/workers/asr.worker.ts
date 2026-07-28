// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Web Worker running the Whisper ASR pipeline via transformers.js.
 * Communicates with the main thread via postMessage.
 */

import { pipeline, env, BaseStreamer } from '@huggingface/transformers';

// Disable local model check — always fetch from HF CDN
env.allowLocalModels = false;

type ASRBackend = 'webgpu' | 'wasm';
type RequestId = number;

const SAMPLE_RATE = 16000;
const CHUNK_LENGTH_S = 30;
// Two seconds of context on each side protects words at chunk boundaries while
// avoiding the substantial repeated work caused by the previous five seconds.
const STRIDE_LENGTH_S = 2;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;
let loadedModelId: string | null = null;
let backend: ASRBackend | null = null;

function postMessage(type: string, payload: unknown, requestId: RequestId): void {
  self.postMessage({ type, payload, requestId });
}

class ChunkProgressStreamer extends BaseStreamer {
  constructor(private readonly onEnd: () => void) {
    super();
  }

  // Progress only needs the end-of-generation signal. Avoid decoding every
  // generated token, which would add work to the transcription hot path.
  put(): void {}

  end(): void {
    this.onEnd();
  }
}

function getChunkCount(sampleCount: number): number {
  const windowSamples = SAMPLE_RATE * CHUNK_LENGTH_S;
  if (sampleCount <= windowSamples) return 1;

  const strideSamples = SAMPLE_RATE * STRIDE_LENGTH_S;
  const jumpSamples = windowSamples - (2 * strideSamples);
  return 1 + Math.ceil((sampleCount - windowSamples) / jumpSamples);
}

function createProgressStreamer(
  audio: Float32Array,
  attempt: number,
  requestId: RequestId,
) {
  const totalChunks = getChunkCount(audio.length);
  const audioSeconds = audio.length / SAMPLE_RATE;
  const startedAt = performance.now();
  let completedChunks = 0;

  return new ChunkProgressStreamer(() => {
    completedChunks = Math.min(completedChunks + 1, totalChunks);
    postMessage('transcription-progress', {
      attempt,
      audioSeconds,
      completedChunks,
      totalChunks,
      elapsedMs: performance.now() - startedAt,
    }, requestId);
  });
}

async function runTranscription(
  audio: Float32Array,
  returnTimestamps: 'word' | true,
  attempt: number,
  requestId: RequestId,
) {
  return asr(audio, {
    return_timestamps: returnTimestamps,
    chunk_length_s: CHUNK_LENGTH_S,
    stride_length_s: STRIDE_LENGTH_S,
    streamer: createProgressStreamer(audio, attempt, requestId),
  });
}

async function handleMessage(message: {
  type: string;
  payload: Record<string, unknown>;
  requestId: RequestId;
}): Promise<void> {
  const { type, payload, requestId } = message;

  if (type === 'load') {
    const modelId = payload.modelId as string;
    try {
      if (asr && loadedModelId === modelId && backend) {
        postMessage('loaded', { modelId, backend }, requestId);
        return;
      }

      if (asr) {
        await asr.dispose();
        asr = null;
        loadedModelId = null;
        backend = null;
      }

      const device: ASRBackend = 'gpu' in navigator ? 'webgpu' : 'wasm';
      // q8 is compact and fast in WASM, but incurs slow dequantization on
      // WebGPU. This per-module layout is the Transformers.js recommendation
      // for Whisper on WebGPU.
      const dtype = device === 'webgpu'
        ? { encoder_model: 'fp32' as const, decoder_model_merged: 'q4' as const }
        : 'q8' as const;

      asr = await pipeline('automatic-speech-recognition', modelId, {
        device,
        dtype,
        progress_callback: (progress: { status: string; progress?: number; loaded?: number; total?: number }) => {
          postMessage('progress', progress, requestId);
        },
      });

      // Compile WebGPU shaders before the user's real audio arrives. Loading is
      // started from the recording screen, so this normally overlaps recording.
      if (device === 'webgpu') {
        postMessage('progress', { status: 'warming' }, requestId);
        await asr(new Float32Array(SAMPLE_RATE), { max_new_tokens: 1 });
      }

      loadedModelId = modelId;
      backend = device;
      postMessage('loaded', { modelId, backend: device }, requestId);
    } catch (err) {
      asr = null;
      loadedModelId = null;
      backend = null;
      postMessage('error', String(err), requestId);
    }
    return;
  }

  if (type === 'transcribe') {
    if (!asr) {
      postMessage('error', 'Model not loaded', requestId);
      return;
    }
    try {
      const { audio } = payload as { audio: Float32Array };
      const result = await runTranscription(audio, 'word', 1, requestId);
      postMessage('result', result, requestId);
    } catch {
      // Fallback: try segment timestamps
      try {
        const { audio } = payload as { audio: Float32Array };
        postMessage('transcription-retry', {
          attempt: 2,
          audioSeconds: audio.length / SAMPLE_RATE,
          completedChunks: 0,
          totalChunks: getChunkCount(audio.length),
          elapsedMs: 0,
        }, requestId);
        const result = await runTranscription(audio, true, 2, requestId);
        postMessage('result', { ...result, segmentLevel: true }, requestId);
      } catch (err2) {
        postMessage('error', String(err2), requestId);
      }
    }
    return;
  }
}

// Model loading, disposal, and inference all mutate the shared pipeline. Keep
// operations ordered even if navigation causes the main thread to enqueue a
// new model load while an older transcription is still finishing.
let operationQueue = Promise.resolve();

self.onmessage = (e: MessageEvent) => {
  const message = e.data;
  operationQueue = operationQueue
    .then(() => handleMessage(message))
    .catch((err) => {
      postMessage('error', String(err), message.requestId);
    });
};
