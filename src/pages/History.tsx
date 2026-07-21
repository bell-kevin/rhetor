// SPDX-License-Identifier: AGPL-3.0-only
import { useState, useEffect } from 'react';
import { getAllSessions, deleteSession, deleteAllAudio, type Session } from '@/lib/db';
import { StorageMeter } from '@/components/StorageMeter';

interface HistoryPageProps {
  navigate: (path: string) => void;
}

export function HistoryPage({ navigate }: HistoryPageProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAllSessions().then(setSessions);
  }, []);

  const categories = [...new Set(sessions.map((s) => s.category))];

  const filtered = sessions.filter((s) => {
    if (filter && s.category !== filter) return false;
    if (search && !s.questionText.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDeleteAudio = async () => {
    if (confirm('Delete all audio recordings? Metrics and transcripts will be kept.')) {
      await deleteAllAudio();
    }
  };

  if (sessions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
          &larr; Home
        </button>
        <h1 className="font-display text-3xl text-cream">History</h1>
        <div className="panel p-8 text-center">
          <p className="text-cream-dim">No sessions yet. Complete a practice round to see your history here.</p>
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <button onClick={() => navigate('')} className="text-sm text-cream-dim hover:text-cream font-mono">
        &larr; Home
      </button>
      <h1 className="font-display text-3xl text-cream">History</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions..."
          className="flex-1 min-w-[200px] panel px-3 py-2 text-sm text-cream bg-bakelite border-hairline rounded placeholder-cream-dim/50"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="panel px-3 py-2 text-sm text-cream bg-bakelite border-hairline rounded"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {filtered.map((s) => (
          <div key={s.id} className="panel p-4 flex items-center gap-4 hover:border-hairline/80">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`results/${s.id}`)}
                className="text-sm text-cream hover:text-vu-amber truncate block text-left w-full"
              >
                {s.questionText}
              </button>
              <div className="flex gap-3 mt-1 text-xs font-mono text-cream-dim">
                <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                <span>{s.analysis.metrics.durationSeconds}s</span>
                <span>Score: {s.analysis.metrics.score}</span>
                <span>Fillers: {s.analysis.metrics.fillerRate}/min</span>
              </div>
            </div>
            <button
              onClick={() => handleDelete(s.id)}
              className="text-xs text-cream-dim hover:text-tally font-mono shrink-0"
              aria-label="Delete session"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Storage */}
      <div className="space-y-3 pt-4 border-t border-hairline">
        <StorageMeter />
        <button
          onClick={handleDeleteAudio}
          className="text-xs text-cream-dim hover:text-vu-amber font-mono"
        >
          Delete all audio, keep metrics
        </button>
      </div>
    </div>
  );
}
