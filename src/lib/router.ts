// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Simple hash-based router for the SPA.
 */

import { useState, useEffect, useCallback } from 'react';

export type Route =
  | { page: 'home' }
  | { page: 'practice'; mode: 'warmup' | 'mock' | 'free'; step: 'setup' | 'record' | 'processing' }
  | { page: 'results'; id: string }
  | { page: 'history' }
  | { page: 'trends' }
  | { page: 'privacy' }
  | { page: 'settings' }
  | { page: 'about' };

function parseHash(hash: string): Route {
  const h = hash.replace('#', '');
  if (h.startsWith('results/')) return { page: 'results', id: h.slice(8) };
  if (h.startsWith('practice/')) {
    const parts = h.split('/');
    const mode = (parts[1] as 'warmup' | 'mock' | 'free') || 'warmup';
    const step = (parts[2] as 'setup' | 'record' | 'processing') || 'setup';
    return { page: 'practice', mode, step };
  }
  if (h === 'history') return { page: 'history' };
  if (h === 'trends') return { page: 'trends' };
  if (h === 'privacy') return { page: 'privacy' };
  if (h === 'settings') return { page: 'settings' };
  if (h === 'about') return { page: 'about' };
  return { page: 'home' };
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const handler = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path;
  }, []);

  return { route, navigate };
}
