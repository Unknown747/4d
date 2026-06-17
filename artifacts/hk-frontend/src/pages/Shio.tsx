import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ShioData } from '../lib/api';

export default function Shio() {
  const { data, isLoading, error } = useQuery<ShioData>({
    queryKey: ['shio'],
    queryFn: () => fetchApi<ShioData>('/shio'),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (error || !data) return <div className="text-red-400 text-center py-20">{String(error)}</div>;

  const maxScore = Math.max(...data.shioStats.map(s => s.score), 0.01);
  const predictedNames = new Set(data.predictedShios.map(s => s.name));

  const pool2D: { num: string; shio: ShioData['shioStats'][0] }[] = [];
  data.predictedShios.forEach(s => {
    s.nums.forEach(n => pool2D.push({ num: n, shio: s }));
  });
  pool2D.sort((a, b) => a.num.localeCompare(b.num));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">🔮 Shio Terprediksi <span className="text-xs text-slate-500 ml-auto">{data.totalDraws} draw</span></div>

          {data.currentShio && (
            <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-lg mb-4">
              <div className="text-4xl">{data.currentShio.emoji}</div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Shio Draw Terakhir ({data.currentShio.date})</div>
                <div className="text-lg font-bold text-white">{data.currentShio.name}</div>
                <div className="text-sm text-slate-400">2D: <strong className="text-amber-400">{data.currentShio.number}</strong></div>
              </div>
            </div>
          )}

          <div className="text-xs text-slate-500 uppercase tracking-wide font-bold mb-3">🏆 Top 3 Prediksi Berikutnya</div>
          <div className="space-y-2">
            {data.predictedShios.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700">
                <div className="text-xs font-bold text-slate-500 w-5">#{i + 1}</div>
                <div className="text-2xl">{s.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm">{s.name}</div>
                  <div className="text-xs text-slate-500">Muncul {s.count}x · {s.lastIdx === 0 ? 'draw terbaru' : `${s.lastIdx} draw lalu`}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-amber-400">{s.pct}%</div>
                  <div className={`text-xs px-1.5 py-0.5 rounded font-bold mt-0.5 ${i === 0 ? 'bg-red-900/40 text-red-400' : i === 1 ? 'bg-amber-900/40 text-amber-400' : 'bg-blue-900/40 text-blue-400'}`}>
                    {['TOP', '2ND', '3RD'][i]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">📊 Semua 12 Shio</div>
          <div className="space-y-1.5">
            {data.shioStats.map(s => {
              const isActive = predictedNames.has(s.name);
              return (
                <div key={s.name} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isActive ? 'bg-amber-950/30 border border-amber-700/30' : ''}`}>
                  <div className="text-lg w-7 text-center">{s.emoji}</div>
                  <div className="text-sm font-medium text-slate-300 w-16 shrink-0">{s.name}</div>
                  <div className="flex-1">
                    <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(s.score / maxScore) * 100}%`,
                          background: isActive ? '#f59e0b' : '#3b82f6',
                        }}
                      />
                    </div>
                  </div>
                  <div className={`text-xs font-bold w-8 text-right shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-500'}`}>{s.pct}%</div>
                  <div className="text-xs text-slate-600 w-12 text-right shrink-0">{s.lastIdx === 0 ? '🔥 Baru' : `${s.lastIdx} lalu`}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          🔢 Angka 2D per Shio Prediksi
          <span className="text-xs text-slate-500 ml-auto">Taruhan 2D berbasis shio terpilih</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {pool2D.map(p => (
            <div
              key={p.num}
              title={`${p.shio.emoji} ${p.shio.name}`}
              className="flex flex-col items-center gap-0.5 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 min-w-[52px] hover:border-amber-500 transition-colors cursor-default"
            >
              <div className="font-black text-white text-lg leading-none">{p.num}</div>
              <div className="text-base leading-none">{p.shio.emoji}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
