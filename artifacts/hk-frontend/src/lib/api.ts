const BASE = '/api';

export async function fetchApi<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export interface Row {
  id: number;
  market: string;
  draw_date: string;
  result_4d: string;
  result_3d: string;
  result_2d: string;
  source: string;
}

export interface StatsData {
  totalDraws: number;
  latestResult: Row | null;
  recentResults: Row[];
  posStats: {
    pos: number;
    label: string;
    digits: { digit: number; count: number; pct: number; lastDrawsAgo: number }[];
    hotDigit: { digit: number; count: number; pct: number; lastDrawsAgo: number };
    coldDigit: { digit: number; count: number; pct: number; lastDrawsAgo: number };
    freqDigit: { digit: number; count: number; pct: number; lastDrawsAgo: number };
  }[];
  hot2D: { number: string; count: number; lastDrawsAgo: number; isHot: boolean; isOverdue: boolean }[];
  freq2D: { number: string; count: number; lastDrawsAgo: number; isHot: boolean; isOverdue: boolean }[];
  overdue2D: { number: string; count: number; lastDrawsAgo: number; isHot: boolean; isOverdue: boolean }[];
  freq3D: { number: string; count: number; lastDrawsAgo: number }[];
  kepalaStats: { digit: number; count: number; pct: number; lastDrawsAgo: number }[];
  ekorStats: { digit: number; count: number; pct: number; lastDrawsAgo: number }[];
}

export interface ShioEntry {
  name: string;
  emoji: string;
  count: number;
  lastIdx: number;
  pct: number;
  score: number;
  nums: string[];
}

export interface ShioData {
  currentShio: { name: string; emoji: string; number: string; date: string } | null;
  predictedShios: ShioEntry[];
  shioStats: ShioEntry[];
  totalDraws: number;
}

export interface PolaPattern {
  fromDigit: number;
  toDigit: number;
  count: number;
  total: number;
}

export interface PolaData {
  lastResult: string;
  lastEkor: number;
  lastKepala: number;
  ekorPatterns: PolaPattern[];
  kepalaPatterns: PolaPattern[];
  totalPairs: number;
}

export interface FixData {
  fix: Record<string, { number: string; shio: { emoji: string; name: string }; confidence: number }>;
  signals: { shioBonus: string[]; ekorBonus: number[]; totalDraws: number };
}

export interface RekomendasiData {
  tanggal: string;
  angkaKuat: number[];
  predictions: { rank: number; num4d: string; num3d: string; num2d: string; score: number }[];
  signals: { shioBonus: string[]; ekorBonus: number[]; totalDraws: number };
  confidence: number;
}

export interface WinrateData {
  totalChecked: number;
  winrate: {
    '4d': { hits: number; total: number; pct: number };
    '3d': { hits: number; total: number; pct: number };
    '2d': { hits: number; total: number; pct: number };
  };
  history: {
    based_on_date: string;
    angka_kuat: number[];
    top3_4d: string[];
    actual_4d: string | null;
    actual_3d: string | null;
    actual_2d: string | null;
    hit_4d: boolean;
    hit_3d: boolean;
    hit_2d: boolean;
    checked: boolean;
  }[];
}

export interface AccuracyData {
  enough: boolean;
  message?: string;
  totalTested: number;
  winrate: Record<string, { hits: number; total: number; pct: number }>;
  history: { date: string; actual4d: string; actual3d: string; actual2d: string; hit4d: boolean; hit3d: boolean; hit2d: boolean }[];
}

export interface ResultsData {
  total: number;
  data: Row[];
  market: string;
}

export interface BBCampuranData {
  autoMode: boolean;
  activeDigits: number[];
  autoSelectedInfo: { digit: number; score: number }[];
  totalCombinations: number;
  excludedCount: number;
  excludedNumbers: string[];
  predictions: {
    number: string;
    result3d: string;
    result2d: string;
    score: number;
    reason: string;
  }[];
  totalDrawsAnalyzed: number;
}

export interface SyncStatusData {
  lastSync: {
    sgp?: { market: string; fetched_at: string; added: number; skipped: number; status: string; message: string | null } | null;
    sdy?: { market: string; fetched_at: string; added: number; skipped: number; status: string; message: string | null } | null;
  };
  sgp: { total: number; lastDate: string | null };
  sdy: { total: number; lastDate: string | null };
  missingDates: { sgp: number; sdy: number };
}
