import { createContext, useContext, useState, type ReactNode } from 'react';

export type Market = 'sgp' | 'sdy';

export const MARKET_INFO: Record<Market, {
  label: string;
  short: string;
  flag: string;
  days: string;
  color: string;
}> = {
  sgp: {
    label: 'Singapore',
    short: 'SGP',
    flag: '🇸🇬',
    days: 'Sen · Rab · Kam · Sab · Min',
    color: '#dc2626',
  },
  sdy: {
    label: 'Sydney',
    short: 'SDY',
    flag: '🇦🇺',
    days: 'Setiap Hari',
    color: '#f59e0b',
  },
};

interface MarketContextValue {
  market: Market;
  setMarket: (m: Market) => void;
}

const MarketContext = createContext<MarketContextValue>({
  market: 'sgp',
  setMarket: () => {},
});

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<Market>(() => {
    try {
      const saved = localStorage.getItem('toto-market');
      return saved === 'sdy' ? 'sdy' : 'sgp';
    } catch { return 'sgp'; }
  });

  function setMarket(m: Market) {
    setMarketState(m);
    try { localStorage.setItem('toto-market', m); } catch {}
  }

  return (
    <MarketContext.Provider value={{ market, setMarket }}>
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  return useContext(MarketContext);
}
