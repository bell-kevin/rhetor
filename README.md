# rhetor

**A speaking coach that never hears you — everything runs in your browser.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

rhetor is a fully client-side AI interview and public-speaking coach. Record yourself answering interview questions, get instant transcription and delivery analysis — all without any data leaving your device.

## Features

- **In-browser speech recognition** — OpenAI's Whisper model runs locally via transformers.js
- **Filler word detection** — transcribed fillers + acoustic hesitation detection for "um"s Whisper drops
- **Pace analysis** — words per minute with rolling timeline and target band
- **Pause detection** — identifies long pauses, classifies as intentional vs. mid-thought
- **Hedging language** — detects phrases that dilute authority
- **Vocal variety** — pitch tracking via autocorrelation, measured in semitones
- **Composite delivery score** — heuristic 0-100 score with documented weights
- **Coaching notes** — rule-based, plain-spoken feedback
- **Session history & trends** — watch your filler rate fall over time
- **64 interview questions** across 8 categories + 16 free-talk topics
- **PWA with offline support** — works without internet after first model download

## Privacy model

| Destination | Purpose | When |
|---|---|---|
| huggingface.co | Download Whisper model weights (ONNX) | First use only — cached afterward |

**That is it.** No analytics, no telemetry, no crash reporting. Everything else runs locally:
- Audio recordings → IndexedDB
- Transcripts → IndexedDB
- Analysis metrics → IndexedDB
- Settings → localStorage

## How it works

1. **Record** your answer using the browser's MediaRecorder API
2. **Transcribe** using Whisper (tiny.en or base.en) running in a Web Worker via transformers.js, with WebGPU acceleration when available (WASM fallback)
3. **Analyze** delivery using pure TypeScript functions: filler detection, pause analysis, pace calculation, pitch tracking via autocorrelation, hedging detection
4. **Store** everything locally in IndexedDB — export or delete at any time

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app requires a secure context (HTTPS or localhost) for microphone access.

## Deploy

Build produces static files suitable for any hosting:

```bash
npm run build
# Output in dist/ — deploy to Netlify, Vercel, GitHub Pages, etc.
```

## Model sizes

| Model | Download | Accuracy | Recommended for |
|---|---|---|---|
| whisper-tiny.en | ~40-60 MB | Good | Phones, fast feedback |
| whisper-base.en | ~80-150 MB | Better | Desktop, accuracy |

Models are cached by the browser's Cache API after first download.

## Browser support

- Chrome/Edge 90+ (WebGPU acceleration)
- Firefox 100+ (WASM fallback)
- Safari 16+ (WASM fallback)

Requires: MediaRecorder, Web Workers, AudioContext, IndexedDB, getUserMedia.

## License

rhetor is free software released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0-only).

### Why AGPL

Anyone who hosts a modified copy of rhetor must publish their changes under the same license. This ensures that improvements to the speech analysis engine, question bank, or UI remain available to everyone. The AGPL was chosen specifically because a speaking coach collects sensitive data (your voice) — users deserve to verify that no hosted version secretly transmits their recordings.
