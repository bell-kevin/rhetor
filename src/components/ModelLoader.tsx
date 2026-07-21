// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ASRProgress } from '@/lib/asr';

interface ModelLoaderProps {
  progress: ASRProgress | null;
  modelId: string;
  onRetry: () => void;
  error: string | null;
}

export function ModelLoader({ progress, modelId, onRetry, error }: ModelLoaderProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const modelName = modelId.includes('base') ? 'whisper-base.en' : 'whisper-tiny.en';
  const sizeNote = modelId.includes('base') ? '~80–150 MB' : '~40–60 MB';

  let percent = 0;
  let status = 'Preparing model download...';
  if (progress) {
    if (progress.progress !== undefined) {
      percent = Math.round(progress.progress);
      status = `Downloading ${modelName}...`;
    } else if (progress.status === 'ready') {
      status = 'Model ready';
      percent = 100;
    } else {
      status = progress.status || 'Loading...';
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-console/90 backdrop-blur-sm">
        <div className="panel p-8 max-w-md w-full mx-4 space-y-4">
          <h2 className="font-display text-xl text-cream">Model download failed</h2>
          <p className="text-cream-dim text-sm">
            Couldn't download the model. Check your connection and retry.
          </p>
          <p className="font-mono text-xs text-tally">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-vu-amber text-console font-medium rounded text-sm hover:bg-vu-amber/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (percent >= 100) {
    setTimeout(() => setDismissed(true), 500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-console/90 backdrop-blur-sm">
      <div className="panel p-8 max-w-md w-full mx-4 space-y-4">
        <h2 className="font-display text-xl text-cream">Downloading speech model</h2>
        <p className="text-cream-dim text-sm">
          Transcribing on your device requires a one-time download ({sizeNote}).
          The browser caches it afterward — subsequent runs work offline.
        </p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-cream-dim">
            <span>{status}</span>
            <span>{percent}%</span>
          </div>
          <div className="w-full h-2 bg-hairline rounded-full overflow-hidden">
            <div
              className="h-full bg-vu-amber rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
