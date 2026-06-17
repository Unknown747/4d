import { useQuery } from '@tanstack/react-query';
import { fetchApi, type FixData } from '../lib/api';

const TYPES = ['4d', '3d', '2d', 'bb'] as const;
const TYPE_LABELS: Record<string, string> = { '4d': '4D', '3d': '3D', '2d': '2D', 'bb': 'BB' };
const TYPE_DESC: Record<string, string> = {
  '4d': 'Empat digit penuh dari AS-KOP-KEPALA-EKOR',
  '3d': 'KOP-KEPALA-EKOR (3 digit terakhir)',
  '2d': 'KEPALA-EKOR (2 digit terakhir)',
  'bb': 'Bolak-Balik — 4 digit (sama dengan 4D Fix)',
};

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
    </div>
  );
}
