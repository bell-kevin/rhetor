// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Typed IndexedDB module for rhetor.
 * Two object stores:
 *   - sessions: metadata + analysis metrics, keyed by id
 *   - audio: Blob objects, keyed by session id
 */

export interface WordTimestamp {
  text: string;
  start: number;
  end: number;
}

export interface SessionMetrics {
  score: number;
  fillerCount: number;
  fillerRate: number;
  hesitationCount: number;
  paceMedian: number;
  paceInBand: boolean;
  longPauses: number;
  longestPause: number;
  hedgeCount: number;
  hedgeRate: number;
  vocalVariety: number;
  loudnessDynamics: number;
  lengthFit: 'under' | 'in-range' | 'over';
  durationSeconds: number;
}

export interface FillerMark {
  index: number;
  word: string;
  start: number;
  end: number;
  certain: boolean;
}

export interface PauseMark {
  start: number;
  end: number;
  duration: number;
  intentional: boolean;
}

export interface HesitationMark {
  start: number;
  end: number;
  duration: number;
}

export interface HedgeMark {
  index: number;
  phrase: string;
  start: number;
  end: number;
}

export interface AnalysisResult {
  metrics: SessionMetrics;
  fillers: FillerMark[];
  pauses: PauseMark[];
  hesitations: HesitationMark[];
  hedges: HedgeMark[];
  paceTimeline: { time: number; wpm: number }[];
  coachingNotes: string[];
}

export interface Session {
  id: string;
  questionId: string | null;
  questionText: string;
  category: string;
  mode: 'warmup' | 'mock' | 'free';
  take: number;
  createdAt: number;
  durationSeconds: number;
  words: WordTimestamp[];
  transcript: string;
  analysis: AnalysisResult;
}

const DB_NAME = 'rhetor';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('audio')) {
        db.createObjectStore('audio');
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(session: Session, audioBlob: Blob): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'audio'], 'readwrite');
  tx.objectStore('sessions').put(session);
  tx.objectStore('audio').put(audioBlob, session.id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await openDB();
  const tx = db.transaction('sessions', 'readonly');
  const req = tx.objectStore('sessions').get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  const db = await openDB();
  const tx = db.transaction('audio', 'readonly');
  const req = tx.objectStore('audio').get(id);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await openDB();
  const tx = db.transaction('sessions', 'readonly');
  const req = tx.objectStore('sessions').getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const sessions = req.result as Session[];
      sessions.sort((a, b) => b.createdAt - a.createdAt);
      resolve(sessions);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'audio'], 'readwrite');
  tx.objectStore('sessions').delete(id);
  tx.objectStore('audio').delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllAudio(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('audio', 'readwrite');
  tx.objectStore('audio').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteEverything(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['sessions', 'audio'], 'readwrite');
  tx.objectStore('sessions').clear();
  tx.objectStore('audio').clear();
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      localStorage.clear();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function exportAllData(includeAudio: boolean): Promise<string> {
  const sessions = await getAllSessions();
  if (!includeAudio) {
    return JSON.stringify({ sessions }, null, 2);
  }
  const audioData: Record<string, string> = {};
  for (const s of sessions) {
    const blob = await getAudio(s.id);
    if (blob) {
      const buf = await blob.arrayBuffer();
      audioData[s.id] = btoa(String.fromCharCode(...new Uint8Array(buf)));
    }
  }
  return JSON.stringify({ sessions, audio: audioData }, null, 2);
}
