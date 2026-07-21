// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect, useRef, useCallback } from 'react';
import { getSession, getAudio, deleteSession, type Session } from '@/lib/db';
import { MetricCard } from '@/components/MetricCard';
import { ScoreDial } from '@/components/ScoreDial';
import { PaceChart } from '@/components/PaceChart';
import { TranscriptView } from '@/components/TranscriptView';

interface ResultsPageProps {
  id: string;
  navigate: (path: string) => void;
}

export function ResultsPage({ id, navigate }: ResultsPageProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getSession(id).then((s) => setSession(s ?? null));
    getAudio(id).then((blob) => {
      if (blob) setAudioUrl(URL.createObjectURL(blob));
    });
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [id]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleDelete = useCallback(async () => {
    if (confirm('Delete this session? This cannot be undone.')) {
      await deleteSession(id);
      navigate('history');
    }
  }, [id, navigate]);

  const exportMarkdown = useCallback(() => {
    if (!session) return;
    const m = session.analysis.metrics;
    const md = `# ${session.questionText}\n\n**Date:** ${new Date(session.createdAt).toLocaleString()}\n**Duration:** ${m.durationSeconds}s | **Score:** ${m.score}/100\n\n## Metrics\n- Fillers: ${m.fillerCount} (${m.fillerRate}/min)\n- Hesitations: ${m.hesitationCount}\n- Pace: ${m.paceMedian} WPM ${m.paceInBand ? '(in band)' : ''}\n- Long pauses: ${m.longPauses} (longest: ${m.longestPause}s)\n- Hedges: ${m.hedgeCount} (${m.hedgeRate}/min)\n- Vocal variety: ${m.vocalVariety} semitones\n- Length: ${m.lengthFit}\n\n## Transcript\n${session.transcript}\n\n## Coaching\n${session.analysis.coachingNotes.map((n) => `- ${n}`).join('\n')}\n`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rhetor-session-${id.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [session, id]);

  if (!session) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-cream-dim">Loading session...</p>
      </div>
    );
  }

  const m = session.analysis.metrics;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <button onClick={() => navigate('history')} className="text-sm text-cream-dim hover:text-cream font-mono">
          &larr; History
        </button>
        <h1 className="font-display text-2xl text-cream">{session.questionText}</h1>
        <div className="flex flex-wrap gap-4 text-xs font-mono text-cream-dim">
          <span>{new Date(session.createdAt).toLocaleDateString()}</span>
          <span>{m.durationSeconds}s</span>
          <span className="uppercase">{session.mode}</span>
          <span>{session.category}</span>
        </div>
      </div>

      {/* Audio player */}
      {audioUrl && (
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full border border-hairline flex items-center justify-center hover:border-vu-amber transition-colors"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><polygon points="2,0 14,7 2,14"/></svg>
            )}
          </button>
          <span className="font-mono text-sm text-cream-dim">
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(m.durationSeconds / 60)}:{String(m.durationSeconds % 60).padStart(2, '0')}
          </span>
          <audio
            ref={audioRef}
            src={audioUrl}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
          />
        </div>
      )}

      {/* Score + Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2 md:col-span-1 flex justify-center">
          <ScoreDial score={m.score} size={130} />
        </div>
        <MetricCard
          label="Fillers / min"
          value={m.fillerRate}
          status={m.fillerRate > 8 ? 'bad' : m.fillerRate > 4 ? 'warn' : 'good'}
          detail={`${m.fillerCount} total`}
        />
        <MetricCard
          label="Hesitations"
          value={m.hesitationCount}
          status={m.hesitationCount > 4 ? 'bad' : m.hesitationCount > 2 ? 'warn' : 'good'}
          detail="Heard in audio"
        />
        <MetricCard
          label="Pace"
          value={m.paceMedian}
          unit="WPM"
          status={m.paceInBand ? 'good' : 'warn'}
          detail={m.paceInBand ? 'In target band' : 'Outside target band'}
        />
        <MetricCard
          label="Long pauses"
          value={m.longPauses}
          status={m.longPauses > 3 ? 'bad' : m.longPauses > 1 ? 'warn' : 'good'}
          detail={m.longestPause > 0 ? `Longest: ${m.longestPause}s` : undefined}
        />
        <MetricCard
          label="Hedges"
          value={m.hedgeRate}
          unit="/min"
          status={m.hedgeRate > 4 ? 'bad' : m.hedgeRate > 2 ? 'warn' : 'good'}
          detail={`${m.hedgeCount} total`}
        />
        <MetricCard
          label="Vocal variety"
          value={m.vocalVariety}
          unit="st"
          status={m.vocalVariety >= 2 ? 'good' : m.vocalVariety >= 1.5 ? 'warn' : 'bad'}
          detail={m.vocalVariety < 1.5 ? 'Monotone' : m.vocalVariety <= 4 ? 'Engaging' : 'Dynamic'}
        />
        <MetricCard
          label="Length"
          value={m.lengthFit === 'in-range' ? 'Good' : m.lengthFit === 'under' ? 'Short' : 'Long'}
          status={m.lengthFit === 'in-range' ? 'good' : 'warn'}
          detail={`${m.durationSeconds}s`}
        />
      </div>

      {/* Pace chart */}
      <PaceChart
        timeline={session.analysis.paceTimeline}
        targetMin={115}
        targetMax={160}
        pauses={session.analysis.pauses.map((p) => ({ start: p.start - (session.words[0]?.start || 0), duration: p.duration }))}
        onSeek={seekTo}
      />

      {/* Transcript */}
      <div>
        <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim mb-3">TRANSCRIPT</h2>
        <TranscriptView
          words={session.words}
          fillers={session.analysis.fillers}
          hedges={session.analysis.hedges}
          pauses={session.analysis.pauses}
          hesitations={session.analysis.hesitations}
          currentTime={currentTime}
          onSeek={seekTo}
        />
      </div>

      {/* Coaching notes */}
      {session.analysis.coachingNotes.length > 0 && (
        <div className="panel p-5 space-y-3">
          <h2 className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">COACHING</h2>
          <ul className="space-y-2">
            {session.analysis.coachingNotes.map((note, i) => (
              <li key={i} className="text-sm text-cream-dim leading-relaxed pl-3 border-l-2 border-vu-amber">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-hairline">
        <button
          onClick={() => navigate(`practice/${session.mode}/setup`)}
          className="px-4 py-2 text-sm font-mono text-cream-dim border border-hairline rounded hover:text-cream hover:border-cream-dim transition-colors"
        >
          Re-record this question
        </button>
        <button
          onClick={exportMarkdown}
          className="px-4 py-2 text-sm font-mono text-cream-dim border border-hairline rounded hover:text-cream hover:border-cream-dim transition-colors"
        >
          Export as Markdown
        </button>
        <button
          onClick={handleDelete}
          className="px-4 py-2 text-sm font-mono text-tally border border-hairline rounded hover:border-tally transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
