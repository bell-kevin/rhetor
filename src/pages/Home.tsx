// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect } from 'react';
import { getAllSessions, type Session } from '@/lib/db';

interface HomePageProps {
  navigate: (path: string) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const [lastSession, setLastSession] = useState<Session | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    getAllSessions().then((sessions) => {
      setSessionCount(sessions.length);
      if (sessions.length > 0) setLastSession(sessions[0]);
      else setIsFirstVisit(true);
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-12">
      {/* Hero */}
      <header className="space-y-4 text-center">
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight text-cream">
          rhetor
        </h1>
        <p className="text-cream-dim text-lg max-w-md mx-auto">
          A speaking coach that never hears you — everything runs in your browser.
        </p>
      </header>

      {/* First visit explainer */}
      {isFirstVisit && (
        <div className="panel p-6 space-y-3">
          <h2 className="font-display text-lg text-cream">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-4 text-sm text-cream-dim">
            <div className="space-y-1">
              <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber">1. RECORD</div>
              <p>Answer an interview question with your microphone. Audio stays on your device.</p>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber">2. TRANSCRIBE</div>
              <p>A neural speech model (Whisper) runs locally in your browser. One download, then offline forever.</p>
            </div>
            <div className="space-y-1">
              <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber">3. ANALYZE</div>
              <p>Get filler counts, pace, pause analysis, vocal variety, and coaching notes. Watch your rate fall over time.</p>
            </div>
          </div>
          <div className="border-t border-hairline pt-3 mt-3">
            <p className="text-xs text-cream-dim">
              No audio, transcript, or metric ever leaves this device. The only network request is downloading the model weights (~40 MB) from Hugging Face on first use.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('practice/warmup/setup')}
          className="panel p-6 text-left hover:border-vu-amber/50 transition-colors group"
        >
          <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber mb-2">WARM-UP</div>
          <h3 className="font-display text-lg text-cream group-hover:text-vu-amber transition-colors">One question</h3>
          <p className="text-sm text-cream-dim mt-1">Random pick, quick drill.</p>
        </button>

        <button
          onClick={() => navigate('practice/mock/setup')}
          className="panel p-6 text-left hover:border-vu-amber/50 transition-colors group"
        >
          <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber mb-2">MOCK INTERVIEW</div>
          <h3 className="font-display text-lg text-cream group-hover:text-vu-amber transition-colors">3-7 questions</h3>
          <p className="text-sm text-cream-dim mt-1">Category pick or shuffle.</p>
        </button>

        <button
          onClick={() => navigate('practice/free/setup')}
          className="panel p-6 text-left hover:border-vu-amber/50 transition-colors group"
        >
          <div className="font-mono text-[10px] tracking-widest uppercase text-vu-amber mb-2">FREE TALK</div>
          <h3 className="font-display text-lg text-cream group-hover:text-vu-amber transition-colors">Impromptu topic</h3>
          <p className="text-sm text-cream-dim mt-1">Table-topics style, 1-2 min.</p>
        </button>
      </div>

      {/* Last session summary */}
      {lastSession && (
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">LAST SESSION</div>
              <p className="text-sm text-cream truncate max-w-xs">{lastSession.questionText}</p>
              <div className="flex gap-4 text-xs font-mono text-cream-dim">
                <span>Score: {lastSession.analysis.metrics.score}</span>
                <span>Fillers: {lastSession.analysis.metrics.fillerRate}/min</span>
                <span>Pace: {lastSession.analysis.metrics.paceMedian} WPM</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`results/${lastSession.id}`)}
              className="text-sm text-vu-amber hover:underline font-mono"
            >
              View
            </button>
          </div>
          {sessionCount > 1 && (
            <div className="mt-3 pt-3 border-t border-hairline flex gap-4">
              <button onClick={() => navigate('history')} className="text-xs text-cream-dim hover:text-cream font-mono">
                {sessionCount} sessions in history
              </button>
              <button onClick={() => navigate('trends')} className="text-xs text-cream-dim hover:text-cream font-mono">
                View trends
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
