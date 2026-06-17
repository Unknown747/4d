import { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import { MarketProvider, useMarket, MARKET_INFO } from './context/MarketContext';
import Dashboard from './pages/Dashboard';
import AngkaFix from './pages/AngkaFix';
import Shio from './pages/Shio';
import PolaIkutan from './pages/PolaIkutan';
import Backtesting from './pages/Backtesting';
import History from './pages/History';
import Paito from './pages/Paito';
import Prediksi from './pages/Prediksi';
import GeminiChat from './pages/GeminiChat';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'prediksi',  label: 'Prediksi',  icon: '🎯' },
  { id: 'paito',     label: 'Paito',     icon: '🎨' },
  { id: 'gemini',    label: 'AI Chat',   icon: '🤖' },
  { id: 'fix',       label: 'Angka Fix', icon: '⭐' },
  { id: 'shio',      label: 'Shio',      icon: '🐉' },
  { id: 'pola',      label: 'Pola',      icon: '🔗' },
  { id: 'backtest',  label: 'Akurasi',   icon: '📈' },
  { id: 'history',   label: 'History',   icon: '📋' },
] as const;

type TabId = typeof TABS[number]['id'];

function AppInner() {
  const [tab, setTab] = useState<TabId>('dashboard');
  const navRef = useRef<HTMLDivElement>(null);
  const { market, setMarket } = useMarket();

  useEffect(() => {
    const btn = navRef.current?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  const info = MARKET_INFO[market];

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-200 font-sans">
      <nav className="sticky top-0 z-50 bg-[#111827] border-b border-[#1e2d45] backdrop-blur px-3 h-14 flex items-center gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center text-base">🎯</div>
          <span className="font-bold text-base hidden sm:inline text-amber-400">Toto Pro</span>
        </div>

        {/* Tabs */}
        <div ref={navRef} className="flex items-center gap-0.5 bg-[#1a2235] rounded-lg p-1 overflow-x-auto scrollbar-hide flex-1">
          {TABS.map(t => (
            <button
              key={t.id}
              data-tab={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                tab === t.id
                  ? 'bg-[#111827] text-white shadow'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e2d45]'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Market switcher */}
        <div className="flex items-center bg-[#0d1420] border border-[#1e2d45] rounded-full p-0.5 gap-0.5 shrink-0">
          {(['sgp', 'sdy'] as const).map(m => {
            const mi = MARKET_INFO[m];
            const active = market === m;
            return (
              <button
                key={m}
                onClick={() => setMarket(m)}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                  active
                    ? m === 'sgp'
                      ? 'bg-red-600 text-white shadow'
                      : 'bg-amber-500 text-black shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mi.flag} {mi.short}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Market banner */}
      <div className={`text-center text-xs py-1 font-medium border-b ${
        market === 'sgp'
          ? 'bg-red-950/40 text-red-300 border-red-900/40'
          : 'bg-amber-950/40 text-amber-300 border-amber-900/40'
      }`}>
        {info.flag} {info.label} &nbsp;·&nbsp; <span className="opacity-70">{info.days}</span>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-5">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'prediksi'  && <Prediksi />}
        {tab === 'paito'     && <Paito />}
        {tab === 'gemini'    && <GeminiChat />}
        {tab === 'fix'       && <AngkaFix />}
        {tab === 'shio'      && <Shio />}
        {tab === 'pola'      && <PolaIkutan />}
        {tab === 'backtest'  && <Backtesting />}
        {tab === 'history'   && <History />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MarketProvider>
          <AppInner />
        </MarketProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
