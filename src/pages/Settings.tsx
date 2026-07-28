// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect } from 'react';
import {
  loadSettings,
  saveSettings,
  type AppSettings,
  DEFAULT_SETTINGS,
  SPEECH_MODEL_IDS,
} from '@/lib/settings';
import { deleteEverything, exportAllData } from '@/lib/db';

interface SettingsPageProps {
  navigate: (path: string) => void;
}

export function SettingsPage({ navigate }: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings());
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [newFiller, setNewFiller] = useState('');
  const [newHedge, setNewHedge] = useState('');
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setMicDevices(devices.filter((d) => d.kind === 'audioinput'));
    });
  }, []);

  const update = (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const handleExport = async (withAudio: boolean) => {
    const json = await exportAllData(withAudio);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhetor-export${withAudio ? '-with-audio' : ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteEverything = async () => {
    if (deleteConfirm !== 'DELETE') return;
    await deleteEverything();
    setDeleteConfirm('');
    navigate('');
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
        &larr; Home
      </button>
      <h1 className="font-display text-3xl text-cream">Settings</h1>

      {/* Model */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">SPEECH MODEL</h2>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={settings.modelId === SPEECH_MODEL_IDS.tiny}
              onChange={() => update({ modelId: SPEECH_MODEL_IDS.tiny })}
              className="accent-vu-amber"
            />
            <div>
              <span className="text-sm text-cream">whisper-tiny.en</span>
              <span className="text-xs text-cream-dim ml-2">~40–120 MB, faster, recommended for phones</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              checked={settings.modelId === SPEECH_MODEL_IDS.base}
              onChange={() => update({ modelId: SPEECH_MODEL_IDS.base })}
              className="accent-vu-amber"
            />
            <div>
              <span className="text-sm text-cream">whisper-base.en</span>
              <span className="text-xs text-cream-dim ml-2">~80–200 MB, more accurate</span>
            </div>
          </label>
        </div>
        <p className="text-xs text-cream-dim">
          Download size depends on browser acceleration. Changing models requires a new download
          on next use; the previous model stays cached.
        </p>
      </section>

      {/* Pace */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">TARGET PACE (WPM)</h2>
        <div className="flex gap-4 items-center">
          <input
            type="number"
            value={settings.targetWpmMin}
            onChange={(e) => update({ targetWpmMin: Number(e.target.value) })}
            className="w-20 panel px-2 py-1 text-sm font-mono text-cream bg-bakelite border-hairline rounded text-center"
          />
          <span className="text-cream-dim">to</span>
          <input
            type="number"
            value={settings.targetWpmMax}
            onChange={(e) => update({ targetWpmMax: Number(e.target.value) })}
            className="w-20 panel px-2 py-1 text-sm font-mono text-cream bg-bakelite border-hairline rounded text-center"
          />
          <span className="text-xs text-cream-dim">WPM</span>
        </div>
      </section>

      {/* Microphone */}
      {micDevices.length > 0 && (
        <section className="panel p-5 space-y-3">
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">MICROPHONE</h2>
          <select
            value={settings.micDeviceId}
            onChange={(e) => update({ micDeviceId: e.target.value })}
            className="w-full panel px-3 py-2 text-sm text-cream bg-bakelite border-hairline rounded"
          >
            <option value="">System default</option>
            {micDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </section>
      )}

      {/* Filler words */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">FILLER WORDS</h2>
        <div className="flex flex-wrap gap-2">
          {settings.fillerWords.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-console border border-hairline rounded text-cream-dim">
              {w}
              <button onClick={() => update({ fillerWords: settings.fillerWords.filter((f) => f !== w) })} className="text-tally hover:text-cream ml-1">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFiller}
            onChange={(e) => setNewFiller(e.target.value)}
            placeholder="Add word..."
            className="flex-1 panel px-2 py-1 text-sm text-cream bg-bakelite border-hairline rounded placeholder-cream-dim/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFiller.trim()) {
                update({ fillerWords: [...settings.fillerWords, newFiller.trim().toLowerCase()] });
                setNewFiller('');
              }
            }}
          />
          <button
            onClick={() => update({ fillerWords: DEFAULT_SETTINGS.fillerWords })}
            className="text-xs text-cream-dim hover:text-cream font-mono"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Hedge phrases */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">HEDGE PHRASES</h2>
        <div className="flex flex-wrap gap-2">
          {settings.hedgePhrases.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono bg-console border border-hairline rounded text-cream-dim">
              {w}
              <button onClick={() => update({ hedgePhrases: settings.hedgePhrases.filter((h) => h !== w) })} className="text-tally hover:text-cream ml-1">&times;</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newHedge}
            onChange={(e) => setNewHedge(e.target.value)}
            placeholder="Add phrase..."
            className="flex-1 panel px-2 py-1 text-sm text-cream bg-bakelite border-hairline rounded placeholder-cream-dim/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newHedge.trim()) {
                update({ hedgePhrases: [...settings.hedgePhrases, newHedge.trim().toLowerCase()] });
                setNewHedge('');
              }
            }}
          />
          <button
            onClick={() => update({ hedgePhrases: DEFAULT_SETTINGS.hedgePhrases })}
            className="text-xs text-cream-dim hover:text-cream font-mono"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Export */}
      <section className="panel p-5 space-y-3">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">EXPORT DATA</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleExport(false)}
            className="px-4 py-2 text-sm font-mono text-cream-dim border border-hairline rounded hover:text-cream hover:border-cream-dim transition-colors"
          >
            Export without audio
          </button>
          <button
            onClick={() => handleExport(true)}
            className="px-4 py-2 text-sm font-mono text-cream-dim border border-hairline rounded hover:text-cream hover:border-cream-dim transition-colors"
          >
            Export with audio
          </button>
        </div>
      </section>

      {/* Delete everything */}
      <section className="panel p-5 space-y-3 border-tally/30">
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-tally">DELETE EVERYTHING</h2>
        <p className="text-sm text-cream-dim">
          This permanently erases all sessions, audio recordings, and settings. Type DELETE to confirm.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="Type DELETE"
            className="flex-1 panel px-3 py-2 text-sm text-cream bg-bakelite border-hairline rounded placeholder-cream-dim/50"
          />
          <button
            onClick={handleDeleteEverything}
            disabled={deleteConfirm !== 'DELETE'}
            className="px-4 py-2 text-sm font-mono text-tally border border-tally/30 rounded hover:bg-tally/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Erase
          </button>
        </div>
      </section>
    </div>
  );
}
