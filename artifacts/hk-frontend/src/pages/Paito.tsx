import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ResultsData } from '../lib/api';

const PERIODS = [10, 30, 50, 100] as const;
type Period = typeof PERIODS[number];
type PosFilter = 'all' | 'as' | 'kop' | 'kepala' | 'ekor';

const POS_OPTIONS: { id: PosFilter; label: string }[] = [
  { id: 'all', label: 'Semua' },
  { id: 'as', label: 'AS' },
  { id: 'kop', label: 'KOP' },
  { id: 'kepala', label: 'KEPALA' },
  { id: 'ekor', label: 'EKOR' },
];

function getColor(freq: number, max: number): string {
  if (max === 0) return '#1a2235';
  const ratio = freq / max;
  if (ratio === 0) return '#1a2235';
  if (ratio < 0.2) return '#1e3a5f';
  if (ratio < 0.4) return '#1d4ed8';
  if (ratio < 0.6) return '#7c3aed';
  if (ratio < 0.8) return '#dc2626';
  return '#f59e0b';
}

export default function Paito() {
  const [period, setPeriod] = useState<Period>(30);
  const [pos, setPos] = useState<PosFilter>('all');

  const { data, isLoading, error } = useQuery<ResultsData>({
    queryKey: ['results-paito', period],
    queryFn: () => fetchApi<ResultsData>(`/results?limit=${period}&offset=0`),
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];

  // Build frequency map for 2D pairs (00-99)
  const freq2D: Record<string, number> = {};
  for (let i = 0; i <= 99; i++) {
    freq2D[String(i).padStart(2, '0')] = 0;
  }

  for (const row of rows) {
    const s = row.result_4d.padStart(4, '0');
    if (pos === 'all' || pos === 'ekor') {
      // EKOR position pairs (kepala+ekor)
      const ke = s.slice(2, 4);
      freq2D[ke] = (freq2D[ke] ?? 0) + 1;
    }
    if (pos === 'as') {
      const as = s.slice(0, 2);
      freq2D[as] = (freq2D[as] ?? 0) + 1;
    }
    if (pos === 'kop') {
      const kop = s.slice(1, 3);
      freq2D[kop] = (freq2D[kop] ?? 0) + 1;
    }
    if (pos === 'kepala') {
      const kep = s.slice(2, 3) + s.slice(3, 4);
      freq2D[kep] = (freq2D[kep] ?? 0) + 1;
    }
  }

  const maxFreq = Math.max(...Object.values(freq2D));

  // Last seen (draws ago) for each 2D
  const lastSeen: Record<string, number> = {};
  for (let i = 0; i <= 99; i++) lastSeen[String(i).padStart(2, '0')] = rows.length;
  rows.forEach((row, idx) => {
    const s = row.result_4d.padStart(4, '0');
    const ke = s.slice(2, 4);
    if (lastSeen[ke] === rows.length) lastSeen[ke] = idx;
  });

  // Top hot & cold
  const sorted = Object.entries(freq2D).sort((a, b) => b[1] - a[1]);
  const hotTop = sorted.filter(([, c]) => c > 0).slice(0, 6);
  const coldTop = sorted.filter(([, c]) => c === 0).slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card">
        <div className="card-header">🎨 Paito Warna HK 4D</div>
        <div className="flex flex-wrap gap-3">
          <div>
            <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Periode</div>
            <div className="flex gap-1.5">
              {PERIODS.map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-amber-400 text-black' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-amber-500'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Posisi</div>
            <div className="flex gap-1.5 flex-wrap">
              {POS_OPTIONS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setPos(o.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pos === o.id ? 'bg-violet-600 text-white' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-violet-500'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d45]">
          <span className="text-xs text-slate-500">Frekuensi:</span>
          {[
            { color: '#1e3a5f', label: 'Sangat Jarang' },
            { color: '#1d4ed8', label: 'Jarang' },
            { color: '#7c3aed', label: 'Sedang' },
            { color: '#dc2626', label: 'Sering' },
            { color: '#f59e0b', label: 'Sangat Sering' },
          ].map(l => (
            <div key={l.color} className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ background: l.color }} />
              <span className="text-xs text-slate-400 hidden sm:inline">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">{String(error)}</div>
      ) : (
        <>
          {/* Paito Grid 10×10 */}
          <div className="card overflow-x-auto">
            <div className="card-header">Grid 00-99 · {rows.length} draw dianalisis</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: '4px' }}>
              {Array.from({ length: 100 }, (_, i) => {
                const num = String(i).padStart(2, '0');
                const count = freq2D[num] ?? 0;
                const color = getColor(count, maxFreq);
                return (
                  <div
                    key={num}
                    title={`${num}: ${count}x`}
                    className="rounded-lg flex flex-col items-center justify-center py-1.5 cursor-default transition-transform hover:scale-110"
                    style={{ background: color, minHeight: '44px' }}
                  >
                    <div className="font-bold text-white text-xs leading-none">{num}</div>
                    <div className="text-white/70 text-[10px] leading-none mt-0.5">{count}x</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hot & Cold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">🔥 Top Hot (Sering Muncul)</div>
              <div className="flex flex-wrap gap-2">
                {hotTop.map(([num, count]) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm border-2 border-amber-500 bg-amber-900/30 text-amber-300">
                      {num}
                    </div>
                    <div className="text-xs text-slate-500">{count}x</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header">❄️ Top Cold (Belum Muncul)</div>
              <div className="flex flex-wrap gap-2">
                {coldTop.length > 0 ? coldTop.map(([num]) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm border-2 border-blue-600 bg-blue-900/30 text-blue-300">
                      {num}
                    </div>
                    <div className="text-xs text-slate-500">0x</div>
                  </div>
                )) : <div className="text-slate-500 text-sm">Semua angka sudah muncul</div>}
              </div>
            </div>
          </div>

          {/* Recent Draws Paito */}
          <div className="card overflow-x-auto">
            <div className="card-header">📋 Paito {Math.min(rows.length, 20)} Draw Terakhir</div>
            <div className="space-y-1">
              {rows.slice(0, 20).map((row) => {
                const s = row.result_4d.padStart(4, '0');
                return (
                  <div key={row.id} className="flex items-center gap-2 text-xs py-1 border-b border-[#1e2d45]/50 last:border-0">
                    <div className="w-24 text-slate-500 shrink-0">{row.draw_date}</div>
                    <div className="flex gap-1">
                      {s.split('').map((d, i) => (
                        <div key={i} className={`w-7 h-7 rounded flex items-center justify-center font-black text-sm ${['ball-as','ball-kop','ball-kep','ball-ekor'][i]}`}>
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="text-slate-600 mx-1">→</div>
                    <div className="font-mono font-bold text-amber-400">{row.result_2d}</div>
                    <div className="font-mono text-slate-500">{row.result_3d}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
