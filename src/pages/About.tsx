// SPDX-License-Identifier: AGPL-3.0-only

interface AboutPageProps {
  navigate: (path: string) => void;
}

export function AboutPage({ navigate }: AboutPageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
        &larr; Home
      </button>
      <h1 className="font-display text-3xl text-cream">About rhetor</h1>

      <div className="panel p-6 space-y-6 text-sm text-cream-dim leading-relaxed">
        <p>
          A <em>rhetor</em> was a teacher of oratory in the ancient world. Demosthenes is said to have
          drilled his diction with pebbles in his mouth. You get a local neural net and a browser that
          never phones home.
        </p>

        <p>
          rhetor is a fully client-side speaking coach. It records your answers to interview questions,
          transcribes them using OpenAI's Whisper model running directly in your browser, and analyzes
          delivery: filler words, filled pauses, pace, silent gaps, hedging language, and vocal variety.
          Every session is stored locally so you can track improvement over time.
        </p>

        <p>
          No audio, transcript, or metric ever leaves your device. The only network request is
          downloading model weights from Hugging Face on first use (cached by the browser afterward).
        </p>

        <div className="border-t border-hairline pt-6">
          <h2 className="font-display text-lg text-cream mb-3">License</h2>
          <p>
            rhetor is free software, released under the{' '}
            <strong className="text-cream">GNU Affero General Public License v3.0</strong> (AGPL-3.0-only).
            Anyone who hosts a modified copy must publish their changes under the same license.
          </p>
        </div>

        <div className="border-t border-hairline pt-6">
          <h2 className="font-display text-lg text-cream mb-3">Credits</h2>
          <ul className="space-y-1">
            <li><strong className="text-cream">Whisper</strong> — OpenAI (MIT License). Speech recognition model weights.</li>
            <li><strong className="text-cream">transformers.js</strong> — Hugging Face (Apache-2.0). Runs ML models in the browser.</li>
            <li><strong className="text-cream">Archivo</strong> — Omnibus-Type (OFL). Display typeface.</li>
            <li><strong className="text-cream">IBM Plex</strong> — IBM (OFL). Body and monospace typefaces.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
