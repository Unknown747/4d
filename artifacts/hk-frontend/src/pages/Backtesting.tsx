import { useQuery } from '@tanstack/react-query';
import { fetchApi, type AccuracyData } from '../lib/api';

function WinrateCard({ label, data }: { label: string; data: { hits: number; total: number; pct: number } }) {
  const color = data.pct >= 30 ? '#10b981' : data.pct >= 15 ? '#f59e0b' : '#3b82f6';
  return (
    <div className="card text-center">
      <div className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">{label}</div>
      <div className="text-4xl font-black mb-1" style={{ color }}>
        {data.pct}%
      </div>
      <div className="text-xs text-slate-500 mb-3">{data.hits} hit dari {data.total} draw</div>
      <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${Math.min(data.pct * 2, 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function Backtesting() {
  const { data, isLoading, error } = useQuery<AccuracyData>({
    queryKey: ['accuracy'],
    queryFn: () => fetchApi<AccuracyData>('/accuracy'),
    staleTime: 120_000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (error) return <div className="text-red-400 text-center py-20">{String(error)}</div>;
  if (!data?.enough) return (
    <div className="card text-center py-16">
      <div className="text-4xl mb-4">📊</div>
      <div className="text-slate-300 font-semibold mb-2">Data Belum Cukup</div>
      <div className="text-slate-500 text-sm">{data?.message ?? 'Tambahkan minimal 8 draw untuk melihat akurasi.'}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 text-center">
        <div className="text-lg font-black text-white mb-0.5">📈 Backtesting — Akurasi Prediksi</div>
        <div className="text-xs text-slate-500 uppercase tracking-widest">
          Simulasi prediksi pada {data.totalTested} draw historis
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <WinrateCard label="4D Win Rate" data={data.winrate['4d']!} />
        <WinrateCard label="3D Win Rate" data={data.winrate['3d']!} />
        <WinrateCard label="2D Win Rate" data={data.winrate['2d']!} />
      </div>

      <div className="card">
        <div className="card-header">
          ℹ️ Cara Membaca Akurasi
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 text-sm text-slate-400">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="font-bold text-white mb-1">4D</div>
            <div>Angka 4D persis cocok dari 10 prediksi yang digenerate. Sangat sulit — keberhasilan {">"} 5% dianggap baik.</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="font-bold text-white mb-1">3D</div>
            <div>3 digit terakhir cocok dari 7 prediksi 3D teratas. {">"} 15% dianggap baik untuk statistik acak.</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="font-bold text-white mb-1">2D</div>
            <div>2 digit terakhir cocok dari 8 prediksi 2D. Baseline acak ~8%, target {">"} 20% menunjukkan pola terdeteksi.</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          📋 Riwayat Backtesting ({data.history.length} draw terakhir)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                <th className="text-left py-2 pr-3">Tanggal</th>
                <th className="text-left py-2 pr-3">Aktual 4D</th>
                <th className="text-left py-2 pr-3">3D</th>
                <th className="text-left py-2 pr-3">2D</th>
                <th className="text-center py-2 pr-3">Hit 4D</th>
                <th className="text-center py-2 pr-3">Hit 3D</th>
                <th className="text-center py-2">Hit 2D</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((row, i) => (
                <tr key={i} className="border-b border-slate-800/50 hover:bg-white/2">
                  <td className="py-2 pr-3 text-slate-400 text-xs">{row.date}</td>
                  <td className="py-2 pr-3 font-mono font-bold text-white">{row.actual4d}</td>
                  <td className="py-2 pr-3 font-mono text-amber-400">{row.actual3d}</td>
                  <td className="py-2 pr-3 font-mono text-green-400">{row.actual2d}</td>
                  <td className="py-2 pr-3 text-center">
                    {row.hit4d
                      ? <span className="text-green-400 font-bold">✓</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-2 pr-3 text-center">
                    {row.hit3d
                      ? <span className="text-green-400 font-bold">✓</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-2 text-center">
                    {row.hit2d
                      ? <span className="text-green-400 font-bold">✓</span>
                      : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex gap-4 text-xs text-slate-500 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-bold text-base">✓</span>
            Angka aktual ada dalam daftar prediksi
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-bold">—</span>
            Tidak ada di daftar prediksi
          </div>
        </div>
      </div>
    </div>
  );
}
