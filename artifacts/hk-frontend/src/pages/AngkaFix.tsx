import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type FixData, type BBCampuranData } from '../lib/api';

const TYPES = ['4d', '3d', '2d', 'bb'] as const;
const TYPE_LABELS: Record<string, string> = { '4d': '4D', '3d': '3D', '2d': '2D', 'bb': 'BB' };
const TYPE_DESC: Record<string, string> = {
  '4d': 'Empat digit penuh dari AS-KOP-KEPALA-EKOR',
  '3d': 'KOP-KEPALA-EKOR (3 digit terakhir)',
  '2d': 'KEPALA-EKOR (2 digit terakhir)',
  'bb': 'Bolak-Balik — 4 digit (sama dengan 4D Fix)',
};

function BBCampuran() {
  const [autoMode, setAutoMode] = useState(true);
  const [selectedDigits, setSelectedDigits] = useState<Set<number>>(new Set());

  const digitsParam = autoMode ? '' : [...selectedDigits].sort().join('');
  const enabled = autoMode || selectedDigits.size >= 2;

  const { data, isLoading, isFetching, error, refetch } = useQuery<BBCampuranData>({
    queryKey: ['bb-campuran', digitsParam, autoMode],
    queryFn: () => fetchApi<BBCampuranData>(`/bb-campuran${digitsParam ? `?digits=${digitsParam}` : ''}`),
    staleTime: 30_000,
    enabled,
  });

  function toggleDigit(d: number) {
    if (autoMode) return;
    setSelectedDigits(prev => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else if (next.size < 9) next.add(d);
      return next;
    });
  }

  return (
    <div className="card">
      <div className="card-header">🔢 BB Campuran — Kombinasi Interaktif</div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setAutoMode(true); setSelectedDigits(new Set()); }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${autoMode ? 'bg-amber-400 text-black' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-amber-500'}`}
        >
          ⚡ Auto (Top 5 Digit)
        </button>
        <button
          onClick={() => setAutoMode(false)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!autoMode ? 'bg-violet-600 text-white' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-violet-500'}`}
        >
          🎯 Pilih Digit Manual
        </button>
      </div>

      {!autoMode && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Pilih 2–9 Digit Aktif</div>
          <div className="flex flex-wrap gap-2 mb-2">
            {Array.from({ length: 10 }, (_, d) => (
              <button
                key={d}
                onClick={() => toggleDigit(d)}
                className={`w-12 h-12 rounded-xl font-black text-xl transition-all border-2 ${
                  selectedDigits.has(d)
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 scale-110 shadow-lg shadow-amber-900/40'
                    : 'bg-[#1a2235] border-[#1e2d45] text-slate-500 hover:border-slate-500 hover:text-slate-300'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            Dipilih: <strong className="text-white">{selectedDigits.size}</strong> digit
            {selectedDigits.size >= 2
              ? ` → ${Math.pow(selectedDigits.size, 4).toLocaleString()} kombinasi`
              : ' (min. 2 digit)'}
          </div>
        </div>
      )}

      {!enabled ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Pilih minimal 2 digit untuk generate kombinasi
        </div>
      ) : isLoading || isFetching ? (
        <div className="flex justify-center py-8"><div className="spinner" /></div>
      ) : error ? (
        <div className="text-red-400 text-sm py-4">{String(error)}</div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-[#1a2235] rounded-lg text-xs text-slate-400 border border-[#1e2d45]">
            <span>Digit aktif:&nbsp;
              {data.activeDigits.map(d => (
                <strong key={d} className="text-amber-400 mr-1">{d}</strong>
              ))}
            </span>
            <span>Total: <strong className="text-white">{data.totalCombinations.toLocaleString()}</strong> kombinasi</span>
            <span>Dikecualikan: <strong className="text-red-400">{data.excludedCount}</strong></span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800/60 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="text-center py-2 px-2 w-8">#</th>
                  <th className="text-center py-2 px-3">4D</th>
                  <th className="text-center py-2 px-3">3D</th>
                  <th className="text-center py-2 px-3">2D</th>
                  <th className="text-left py-2 px-3 w-28">Skor</th>
                  <th className="text-left py-2 px-3 hidden sm:table-cell">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {data.predictions.map((p, i) => (
                  <tr key={p.number} className={`border-b border-slate-800/50 hover:bg-white/3 transition-colors ${i === 0 ? 'bg-amber-500/5' : ''}`}>
                    <td className="text-center py-2 px-2 text-slate-600 text-xs">{i + 1}</td>
                    <td className="text-center py-2 px-3">
                      <span className={`font-black font-mono text-base tracking-widest ${i === 0 ? 'text-amber-400' : 'text-white'}`}>
                        {p.number}
                      </span>
                      {i === 0 && <span className="ml-1 text-amber-500 text-xs">★</span>}
                    </td>
                    <td className="text-center py-2 px-3 font-mono text-amber-300/80 text-sm">{p.result3d}</td>
                    <td className="text-center py-2 px-3 font-mono text-green-400/80 text-sm">{p.result2d}</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(p.score, 100)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{p.score}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-xs text-slate-500 hidden sm:table-cell max-w-[200px] truncate">{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!autoMode && (
            <button onClick={() => refetch()} disabled={isFetching} className="mt-3 btn-ghost text-xs">
              🔄 Hitung Ulang
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function AngkaFix() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<FixData>({
    queryKey: ['angka-fix'],
    queryFn: () => fetchApi<FixData>('/angka-fix'),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-900 to-blue-950 border border-blue-900/40 rounded-xl p-6 text-center">
        <div className="text-amber-400 font-black text-xl mb-1">🎯 Angka Fix — Prediksi Terkuat</div>
        <div className="text-slate-500 text-xs uppercase tracking-widest mb-6">Gabungan: Statistik × Shio × Pola Ikutan</div>

        {isLoading ? (
          <div className="flex justify-center py-8"><div className="spinner" /></div>
        ) : error ? (
          <div className="text-red-400 py-8">{String(error)}</div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {TYPES.map(t => {
              const entry = data.fix[t];
              if (!entry) return null;
              const isBB = t === 'bb';
              return (
                <div key={t} className={`rounded-xl border p-4 text-center transition-all hover:scale-[1.02] ${isBB ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700 bg-slate-800/60'}`}>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{TYPE_LABELS[t]}</div>
                  <div className={`font-black tracking-widest text-3xl mb-1 ${isBB ? 'text-amber-400' : 'text-white'}`}>
                    {entry.number}
                  </div>
                  <div className="text-xs text-slate-500 mb-3">{entry.shio.emoji} {entry.shio.name}</div>
                  <div className="bg-slate-700 rounded-full h-1 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${isBB ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-blue-400 to-amber-400'}`}
                      style={{ width: `${entry.confidence}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500">{entry.confidence}% confidence</div>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="mt-6 btn-primary"
        >
          {isFetching ? '⏳ Menghitung...' : '🔄 Hitung Ulang'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">📡 Sinyal Aktif</div>
          {data?.signals && (
            <div className="space-y-4 mt-2">
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">🐉</div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Shio Bonus Aktif</div>
                  <div className="font-semibold text-slate-200">{data.signals.shioBonus.join(' · ')}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">🔚</div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Ekor Bonus (Pola Ikutan)</div>
                  <div className="font-semibold text-slate-200">Ekor {data.signals.ekorBonus.join(', ')}</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">📊</div>
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Basis Analisis</div>
                  <div className="font-semibold text-slate-200">{data.signals.totalDraws} draw historis</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">📋 Keterangan</div>
          <div className="space-y-3 mt-2">
            {TYPES.map(t => (
              <div key={t} className="flex gap-3">
                <span className="font-black text-amber-400 w-8 shrink-0">{TYPE_LABELS[t]}</span>
                <span className="text-sm text-slate-400">{TYPE_DESC[t]}</span>
              </div>
            ))}
            <div className="mt-4 p-3 bg-slate-800 rounded-lg border-l-2 border-amber-500">
              <div className="text-xs font-bold text-amber-400 mb-1">DISCLAIMER</div>
              <div className="text-xs text-slate-500">Prediksi bersifat statistik dan edukatif. Tidak menjamin kemenangan. Gunakan dengan bijak.</div>
            </div>
          </div>
        </div>
      </div>

      <BBCampuran />
    </div>
  );
}
