// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Audio recording and processing utilities.
 * - Record from microphone via MediaRecorder
 * - Decode + resample to 16 kHz mono Float32Array for Whisper
 * - Live RMS level from AnalyserNode
 */

export interface RecordingHandle {
  stop: () => void;
  getBlob: () => Promise<Blob>;
  getElapsed: () => number;
  getLevelDb: () => number;
}

export function getSupportedMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    return 'audio/webm;codecs=opus';
  }
  if (MediaRecorder.isTypeSupported('audio/webm')) {
    return 'audio/webm';
  }
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return '';
}

export function startRecording(
  stream: MediaStream,
  onLevel: (db: number) => void,
  onElapsed: (seconds: number) => void,
): RecordingHandle {
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  let startTime = Date.now();
  let elapsed = 0;
  let stopped = false;

  // Level metering via AnalyserNode
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const dataArray = new Float32Array(analyser.fftSize);

  let levelDb = -60;
  let animFrame: number;

  function updateLevel() {
    if (stopped) return;
    analyser.getFloatTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);
    levelDb = rms > 0 ? 20 * Math.log10(rms) : -60;
    onLevel(levelDb);
    elapsed = (Date.now() - startTime) / 1000;
    onElapsed(elapsed);
    animFrame = requestAnimationFrame(updateLevel);
  }

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(250);
  startTime = Date.now();
  updateLevel();

  let blobResolve: ((b: Blob) => void) | null = null;
  const blobPromise = new Promise<Blob>((resolve) => {
    blobResolve = resolve;
  });

  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
    blobResolve?.(blob);
  };

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(animFrame);
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
      audioCtx.close();
    },
    getBlob() {
      return blobPromise;
    },
    getElapsed() {
      return elapsed;
    },
    getLevelDb() {
      return levelDb;
    },
  };
}

/**
 * Decode an audio Blob and resample to 16 kHz mono Float32Array.
 */
export async function decodeAndResample(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });

  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuf);
    // Mix down to mono at 16 kHz using OfflineAudioContext
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const bufferSource = offline.createBufferSource();
    bufferSource.buffer = decoded;
    bufferSource.connect(offline.destination);
    bufferSource.start();
    const rendered = await offline.startRendering();
    return rendered.getChannelData(0);
  } finally {
    await audioCtx.close();
  }
}
