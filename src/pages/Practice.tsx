// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect, useRef, useCallback } from 'react';
import { VUMeter } from '@/components/VUMeter';
import { TallyLamp } from '@/components/TallyLamp';
import { Timecode } from '@/components/Timecode';
import { ModelLoader } from '@/components/ModelLoader';
import { startRecording, decodeAndResample, type RecordingHandle } from '@/lib/audio';
import { loadModel, transcribe, isModelLoaded, type ASRProgress } from '@/lib/asr';
import { analyzeSession } from '@/lib/analysis';
import type { AnalysisConfig } from '@/lib/analysis/types';
import { saveSession, type Session } from '@/lib/db';
import { loadSettings } from '@/lib/settings';
import questions from '@/data/questions.json';

interface PracticePageProps {
  mode: 'warmup' | 'mock' | 'free';
  step: 'setup' | 'record' | 'processing';
  navigate: (path: string) => void;
}

interface QuestionEntry {
  id: string;
  category: string;
  text: string;
  targetSeconds: [number, number];
  coach: string;
  structure: string | null;
}

const allQuestions = questions as QuestionEntry[];
const categories = [...new Set(allQuestions.map((q) => q.category))];
const interviewCategories = categories.filter((c) => c !== 'Free Talk');
const freeTopics = allQuestions.filter((q) => q.category === 'Free Talk');

function randomPick<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

export function PracticePage({ mode, step, navigate }: PracticePageProps) {
  const settings = loadSettings();

  // Setup state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [questionCount, setQuestionCount] = useState(5);
  const [prepTime, setPrepTime] = useState(0);
  const [customQuestion, setCustomQuestion] = useState('');

  // Recording state
  const [currentQuestion, setCurrentQuestion] = useState<QuestionEntry | null>(null);
  const [questionQueue, setQuestionQueue] = useState<QuestionEntry[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(-60);
  const [elapsed, setElapsed] = useState(0);
  const [prepCountdown, setPrepCountdown] = useState(0);
  const recordingRef = useRef<RecordingHandle | null>(null);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [modelProgress, setModelProgress] = useState<ASRProgress | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');

  const startPractice = useCallback(() => {
    let selected: QuestionEntry[] = [];

    if (customQuestion.trim()) {
      selected = [{
        id: `custom-${Date.now()}`,
        category: 'Custom',
        text: customQuestion.trim(),
        targetSeconds: [60, 120],
        coach: '',
        structure: null,
      }];
    } else if (mode === 'warmup') {
      const pool = selectedCategory
        ? allQuestions.filter((q) => q.category === selectedCategory)
        : allQuestions.filter((q) => q.category !== 'Free Talk');
      selected = randomPick(pool, 1);
    } else if (mode === 'mock') {
      const pool = selectedCategory
        ? allQuestions.filter((q) => q.category === selectedCategory)
        : allQuestions.filter((q) => q.category !== 'Free Talk');
      selected = randomPick(pool, questionCount);
    } else {
      selected = randomPick(freeTopics, 1);
    }

    setQuestionQueue(selected);
    setQueueIndex(0);
    setCurrentQuestion(selected[0]);
    navigate(`practice/${mode}/record`);
  }, [mode, selectedCategory, questionCount, customQuestion, navigate]);

  // Prep timer
  useEffect(() => {
    if (step === 'record' && prepTime > 0 && prepCountdown === 0 && !recording) {
      setPrepCountdown(prepTime);
    }
  }, [step, prepTime, prepCountdown, recording]);

  useEffect(() => {
    if (prepCountdown <= 0) return;
    const timer = setInterval(() => {
      setPrepCountdown((p) => {
        if (p <= 1) {
          clearInterval(timer);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [prepCountdown]);

  const startRec = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          ...(settings.micDeviceId ? { deviceId: { exact: settings.micDeviceId } } : {}),
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const handle = startRecording(stream, setLevel, setElapsed);
      recordingRef.current = handle;
      setRecording(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        alert('Microphone permission denied. Please allow microphone access in your browser settings and try again.');
      } else {
        alert(`Could not access microphone: ${msg}`);
      }
    }
  }, [settings.micDeviceId]);

  const stopRec = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current.stop();
    setRecording(false);
    const blob = await recordingRef.current.getBlob();
    recordingRef.current = null;

    // Process
    setProcessing(true);
    navigate(`practice/${mode}/processing`);

    try {
      // Load model if not loaded
      if (!isModelLoaded()) {
        setProcessingStatus('Loading speech model...');
        await loadModel(settings.modelId, setModelProgress);
      }

      // Decode audio
      setProcessingStatus('Decoding audio...');
      const pcm = await decodeAndResample(blob);

      // Transcribe
      setProcessingStatus('Transcribing on your device...');
      const result = await transcribe(pcm);

      // Analyze
      setProcessingStatus('Analyzing delivery...');
      const config: AnalysisConfig = {
        targetWpmMin: settings.targetWpmMin,
        targetWpmMax: settings.targetWpmMax,
        fillerWords: settings.fillerWords,
        hedgePhrases: settings.hedgePhrases,
        targetSeconds: currentQuestion?.targetSeconds || [60, 120],
      };
      const analysis = analyzeSession(result.words, pcm, config);

      // Save session
      const session: Session = {
        id: crypto.randomUUID(),
        questionId: currentQuestion?.id || null,
        questionText: currentQuestion?.text || 'Free recording',
        category: currentQuestion?.category || 'Custom',
        mode,
        take: 1,
        createdAt: Date.now(),
        durationSeconds: elapsed,
        words: result.words,
        transcript: result.text,
        analysis,
      };

      await saveSession(session, blob);
      navigate(`results/${session.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setModelError(msg);
      setProcessing(false);
    }
  }, [mode, settings, currentQuestion, elapsed, navigate]);

  const retryModel = useCallback(() => {
    setModelError(null);
    setProcessing(false);
    navigate(`practice/${mode}/record`);
  }, [mode, navigate]);

  // Setup screen
  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono mb-4">
            &larr; Back
          </button>
          <h1 className="font-display text-3xl text-cream">
            {mode === 'warmup' ? 'Warm-up' : mode === 'mock' ? 'Mock interview' : 'Free talk'}
          </h1>
        </div>

        {mode !== 'free' && (
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-widest uppercase text-cream-dim block mb-2">
                CATEGORY
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full panel px-3 py-2 text-cream bg-bakelite border-hairline rounded text-sm"
              >
                <option value="">All categories (shuffle)</option>
                {interviewCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {mode === 'mock' && (
              <div>
                <label className="font-mono text-[10px] tracking-widest uppercase text-cream-dim block mb-2">
                  QUESTIONS
                </label>
                <div className="flex gap-2">
                  {[3, 5, 7].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQuestionCount(n)}
                      className={`px-4 py-2 rounded font-mono text-sm border ${
                        questionCount === n ? 'border-vu-amber text-vu-amber' : 'border-hairline text-cream-dim hover:text-cream'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="font-mono text-[10px] tracking-widest uppercase text-cream-dim block mb-2">
                PREP TIME
              </label>
              <div className="flex gap-2">
                {[0, 30, 60].map((t) => (
                  <button
                    key={t}
                    onClick={() => setPrepTime(t)}
                    className={`px-4 py-2 rounded font-mono text-sm border ${
                      prepTime === t ? 'border-vu-amber text-vu-amber' : 'border-hairline text-cream-dim hover:text-cream'
                    }`}
                  >
                    {t === 0 ? 'None' : `${t}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="font-mono text-[10px] tracking-widest uppercase text-cream-dim block mb-2">
            OR TYPE A CUSTOM QUESTION
          </label>
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            placeholder="Type your own question here..."
            className="w-full panel px-3 py-2 text-cream bg-bakelite border-hairline rounded text-sm placeholder-cream-dim/50"
          />
        </div>

        <button
          onClick={startPractice}
          className="w-full py-3 bg-vu-amber text-console font-display font-bold text-lg rounded hover:bg-vu-amber/90 transition-colors"
        >
          Start
        </button>
      </div>
    );
  }

  // Processing screen
  if (step === 'processing' || processing) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
        {modelError ? (
          <ModelLoader progress={modelProgress} modelId={settings.modelId} onRetry={retryModel} error={modelError} />
        ) : (
          <>
            {modelProgress && modelProgress.status !== 'ready' && (
              <ModelLoader progress={modelProgress} modelId={settings.modelId} onRetry={retryModel} error={null} />
            )}
            <div className="space-y-3">
              <div className="w-8 h-8 border-2 border-vu-amber border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-cream font-mono text-sm">{processingStatus}</p>
            </div>
          </>
        )}
      </div>
    );
  }

  // Record screen — the Console
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Question display */}
      <div className="space-y-2">
        {questionQueue.length > 1 && (
          <div className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">
            QUESTION {queueIndex + 1} OF {questionQueue.length}
          </div>
        )}
        <h2 className="font-display text-2xl md:text-3xl text-cream leading-tight">
          {currentQuestion?.text}
        </h2>
        {currentQuestion?.coach && (
          <p className="text-sm text-cream-dim italic">{currentQuestion.coach}</p>
        )}
      </div>

      {/* Console panel */}
      <div className="panel p-6 space-y-6 relative overflow-hidden">
        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-console/20 pointer-events-none" />

        {/* Tally + Timecode */}
        <div className="flex items-center justify-between relative z-10">
          <TallyLamp active={recording} />
          <Timecode seconds={elapsed} className="text-3xl md:text-4xl text-cream" />
        </div>

        {/* VU Meter */}
        <div className="relative z-10">
          <VUMeter level={level} active={recording} />
        </div>

        {/* Prep countdown */}
        {prepCountdown > 0 && !recording && (
          <div className="text-center relative z-10">
            <div className="font-mono text-[10px] tracking-widest uppercase text-cream-dim mb-1">PREP TIME</div>
            <div className="font-mono text-4xl text-vu-amber">{prepCountdown}</div>
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 relative z-10">
          {!recording ? (
            <button
              onClick={startRec}
              disabled={prepCountdown > 0}
              className="px-8 py-3 bg-tally text-cream font-display font-bold rounded hover:bg-tally/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Record
            </button>
          ) : (
            <button
              onClick={stopRec}
              className="px-8 py-3 bg-hairline text-cream font-display font-bold rounded hover:bg-hairline/80 transition-colors border border-tally"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Target length note */}
      {currentQuestion?.targetSeconds && (
        <p className="text-xs text-cream-dim font-mono text-center">
          Target: {Math.floor(currentQuestion.targetSeconds[0] / 60)}:{String(currentQuestion.targetSeconds[0] % 60).padStart(2, '0')} – {Math.floor(currentQuestion.targetSeconds[1] / 60)}:{String(currentQuestion.targetSeconds[1] % 60).padStart(2, '0')}
          {currentQuestion.structure && ` • ${currentQuestion.structure} structure`}
        </p>
      )}
    </div>
  );
}
