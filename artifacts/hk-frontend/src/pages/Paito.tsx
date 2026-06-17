import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ResultsData } from '../lib/api';

const PERIODS = [10, 30, 50, 100] as const;
type Period = typeof PERIODS[number];
type PosFilter = 'all' | 'as' | 'kop' | 'kepala' | 'ekor';

const POS_OPTIONS: { id: PosFilter; label: string; desc: string }[] = [
  { id: 'all',    label: 'Semua',  desc: '2D (KEPALA+EKOR)' },
  { id: 'as',     label: 'AS',     desc: 'AS+KOP (digit 1+2)' },
  { id: 'kop',    label: 'KOP',    desc: 'KOP+KEPALA (digit 2+3)' },
  { id: 'kepala', label: 'KEPALA', desc: 'KEPALA+EKOR (digit 3+4)' },
  { id: 'ekor',   label: 'EKOR',   desc: 'digit terakhir (0x–9x)' },
];

function getColor(freq: number, max: number): string {
  if (max === 0 || freq === 0) return '#1a2235';
  const r = freq / max;
  if (r < 0.2) return '#1e3a5f';
  if (r < 0.4) return '#1d4ed8';
  if (r < 0.6) return '#7c3aed';
  if (r < 0.8) return '#dc2626';
  return '#f59e0b';
}

function extract2D(s4d: string, pos: PosFilter): string {
  // s4d is always 4-char padded
  switch (pos) {
    case 'as':     return s4d.slice(0, 2);
    case 'kop':    return s4d.slice(1, 3);
    case 'kepala': return s4d.slice(2, 4);
    case 'ekor':   return s4d.slice(2, 4);
    default:       return s4d.slice(2, 4); // "all" = standard 2D (KEPALA+EKOR)
  }
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

  // Build frequency map for 2D pairs (00–99)
  const freq2D: Record<string, number> = {};
  for (let i = 0; i <= 99; i++) freq2D[String(i).padStart(2, '0')] = 0;

  for (const row of rows) {
    const s = row.result_4d.padStart(4, '0');
    const key = extract2D(s, pos);
    if (key in freq2D) freq2D[key] = (freq2D[key] ?? 0) + 1;
  }

  const maxFreq = Math.max(...Object.values(freq2D), 1);

  // Last seen (draws ago) for each 2D per current pos
  const lastSeen: Record<string, number> = {};
  for (let i = 0; i <= 99; i++) lastSeen[String(i).padStart(2, '0')] = rows.length;
  rows.forEach((row, idx) => {
    const s = row.result_4d.padStart(4, '0');
    const key = extract2D(s, pos);
    if (lastSeen[key] === rows.length) lastSeen[key] = idx; // first occurrence = idx draws ago
  });

  const sorted = Object.entries(freq2D).sort((a, b) => b[1] - a[1]);
  const hotTop  = sorted.filter(([, c]) => c > 0).slice(0, 8);
  const coldTop = sorted.filter(([, c]) => c === 0).slice(0, 8);

  const posInfo = POS_OPTIONS.find(o => o.id === pos)!;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card">
        <div className="card-header">🎨 Paito Warna HK 4D</div>
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Periode (draw terakhir)</div>
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
            <div className="text-xs text-slate-500 mb-1.5 font-medium uppercase tracking-wide">Posisi Analisis</div>
            <div className="flex gap-1.5 flex-wrap">
              {POS_OPTIONS.map(o => (
                <button
                  key={o.id}
                  onClick={() => setPos(o.id)}
                  title={o.desc}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${pos === o.id ? 'bg-violet-600 text-white' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-violet-500'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filter info */}
        <div className="mt-3 text-xs text-violet-400 bg-violet-900/10 border border-violet-800/30 rounded-lg px-3 py-2">
          📌 Menampilkan: <strong>{posInfo.desc}</strong> — {rows.length} draw dianalisis
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#1e2d45] flex-wrap">
          <span className="text-xs text-slate-500">Frekuensi:</span>
          {[
            { color: '#1a2235', label: 'Belum Muncul' },
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
        <div className="card flex flex-col items-center gap-3 py-16">
          <div className="spinner" />
          <div className="text-slate-500 text-sm">Memuat data paito...</div>
        </div>
      ) : error ? (
        <div className="card text-red-400 text-center py-8">{String(error)}</div>
      ) : (
        <>
          {/* Grid 10×10 */}
          <div className="card overflow-x-auto">
            <div className="card-header">Grid 00–99 · {posInfo.label} · {rows.length} draw</div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(10, minmax(0, 1fr))', gap: '4px' }}>
              {Array.from({ length: 100 }, (_, i) => {
                const num   = String(i).padStart(2, '0');
                const count = freq2D[num] ?? 0;
                const ago   = lastSeen[num] ?? rows.length;
                const color = getColor(count, maxFreq);
                return (
                  <div
                    key={num}
                    title={`${num}: ${count}x · terakhir ${ago === rows.length ? 'belum pernah' : ago + ' draw lalu'}`}
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
              <div className="card-header">🔥 Top Hot — Sering Muncul</div>
              <div className="flex flex-wrap gap-2">
                {hotTop.length > 0 ? hotTop.map(([num, count]) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm border-2 border-amber-500 bg-amber-900/30 text-amber-300">{num}</div>
                    <div className="text-xs text-slate-500">{count}x</div>
                  </div>
                )) : <div className="text-slate-500 text-sm">Tidak ada data</div>}
              </div>
            </div>
            <div className="card">
              <div className="card-header">❄️ Top Cold — Belum / Jarang Muncul</div>
              <div className="flex flex-wrap gap-2">
                {coldTop.length > 0 ? coldTop.map(([num]) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm border-2 border-blue-600 bg-blue-900/30 text-blue-300">{num}</div>
                    <div className="text-xs text-slate-500">0x</div>
                  </div>
                )) : <div className="text-slate-500 text-sm">Semua angka sudah muncul</div>}
              </div>
            </div>
          </div>

          {/* Recent Draws Table */}
          <div className="card overflow-x-auto">
            <div className="card-header">📋 Paito {Math.min(rows.length, 20)} Draw Terakhir · Posisi {posInfo.label}</div>
            <div className="space-y-1">
              {rows.slice(0, 20).map((row) => {
                const s  = row.result_4d.padStart(4, '0');
                const highlight = extract2D(s, pos);
                return (
                  <div key={row.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-[#1e2d45]/50 last:border-0">
                    <div className="w-24 text-slate-500 shrink-0">{row.draw_date}</div>
                    <div className="flex gap-1">
                      {s.split('').map((d, i) => (
                        <div key={i} className={`w-7 h-7 rounded flex items-center justify-center font-black text-sm ${['ball-as','ball-kop','ball-kep','ball-ekor'][i]}`}>{d}</div>
                      ))}
                    </div>
                    <div className="text-slate-600 mx-1">→</div>
                    <div className="font-mono font-black text-base text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded px-2 py-0.5">{highlight}</div>
                    <div className="font-mono text-slate-500">{posInfo.desc}</div>
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
