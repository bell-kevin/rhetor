// SPDX-License-Identifier: AGPL-3.0-only
import { useEffect, useState } from 'react';
import { useRouter } from '@/lib/router';
import { HomePage } from '@/pages/Home';
import { PracticePage } from '@/pages/Practice';
import { ResultsPage } from '@/pages/Results';
import { HistoryPage } from '@/pages/History';
import { TrendsPage } from '@/pages/Trends';
import { PrivacyPage } from '@/pages/Privacy';
import { SettingsPage } from '@/pages/Settings';
import { AboutPage } from '@/pages/About';

function UpdateToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              setShow(true);
            }
          });
        });
      });
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 panel p-4 flex items-center gap-3 shadow-lg">
      <span className="text-sm text-cream">Update available</span>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1 text-xs font-mono bg-vu-amber text-console rounded"
      >
        Reload
      </button>
    </div>
  );
}

function Nav({ navigate }: { navigate: (path: string) => void }) {
  return (
    <nav className="border-b border-hairline">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate('')} className="font-display text-lg font-bold text-cream hover:text-vu-amber transition-colors">
          rhetor
        </button>
        <div className="flex gap-4 text-xs font-mono text-cream-dim">
          <button onClick={() => navigate('history')} className="hover:text-cream transition-colors">History</button>
          <button onClick={() => navigate('trends')} className="hover:text-cream transition-colors">Trends</button>
          <button onClick={() => navigate('privacy')} className="hover:text-cream transition-colors">Privacy</button>
          <button onClick={() => navigate('settings')} className="hover:text-cream transition-colors">Settings</button>
          <button onClick={() => navigate('about')} className="hover:text-cream transition-colors">About</button>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-hairline mt-16 py-6">
      <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-cream-dim">
        <span>rhetor — a speaking coach that never hears you</span>
        <a
          href="https://github.com/rhetor-app/rhetor"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-cream transition-colors"
        >
          Free software — AGPL-3.0
        </a>
      </div>
    </footer>
  );
}

export default function App() {
  const { route, navigate } = useRouter();

  let page: React.ReactNode;
  switch (route.page) {
    case 'home':
      page = <HomePage navigate={navigate} />;
      break;
    case 'practice':
      page = <PracticePage mode={route.mode} step={route.step} navigate={navigate} />;
      break;
    case 'results':
      page = <ResultsPage id={route.id} navigate={navigate} />;
      break;
    case 'history':
      page = <HistoryPage navigate={navigate} />;
      break;
    case 'trends':
      page = <TrendsPage navigate={navigate} />;
      break;
    case 'privacy':
      page = <PrivacyPage navigate={navigate} />;
      break;
    case 'settings':
      page = <SettingsPage navigate={navigate} />;
      break;
    case 'about':
      page = <AboutPage navigate={navigate} />;
      break;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Nav navigate={navigate} />
      <main className="flex-1">{page}</main>
      <Footer />
      <UpdateToast />
    </div>
  );
}
