// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect } from 'react';
import { getAllSessions, type Session } from '@/lib/db';
import { TrendChart } from '@/components/TrendChart';
import { loadSettings } from '@/lib/settings';

interface TrendsPageProps {
  navigate: (path: string) => void;
}

export function TrendsPage({ navigate }: TrendsPageProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const settings = loadSettings();

  useEffect(() => {
    getAllSessions().then(setSessions);
  }, []);

  // Practice-day streak
  const practiceDays = new Set(sessions.map((s) => new Date(s.createdAt).toDateString()));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (practiceDays.has(d.toDateString())) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  if (sessions.length < 2) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
          &larr; Home
        </button>
        <h1 className="font-display text-3xl text-cream">Trends</h1>
        <div className="panel p-8 text-center">
          <p className="text-cream-dim">Complete at least 2 sessions to see your trends.</p>
          <button
            onClick={() => navigate('practice/warmup/setup')}
            className="mt-4 px-4 py-2 bg-vu-amber text-console font-medium rounded text-sm"
          >
            Start practicing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
        &larr; Home
      </button>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-cream">Trends</h1>
        {streak > 0 && (
          <div className="text-right">
            <div className="font-mono text-2xl text-vu-amber">{streak}</div>
            <div className="font-mono text-[10px] tracking-widest uppercase text-cream-dim">DAY STREAK</div>
          </div>
        )}
      </div>

      <TrendChart sessions={sessions} metric="fillerRate" />
      <TrendChart sessions={sessions} metric="pace" targetMin={settings.targetWpmMin} targetMax={settings.targetWpmMax} />
      <TrendChart sessions={sessions} metric="variety" />

      <p className="text-xs text-cream-dim font-mono text-center">
        {sessions.length} sessions tracked
      </p>
    </div>
  );
}
