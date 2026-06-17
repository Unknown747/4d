import { useQuery } from '@tanstack/react-query';
import { fetchApi, type StatsData } from '../lib/api';

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 text-right text-xs text-slate-500 shrink-0">{label}</div>
      <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
      <div className="w-6 text-xs text-slate-500">{value}x</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: () => fetchApi<StatsData>('/stats'),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (error || !data) return <div className="text-red-400 text-center py-20">{String(error)}</div>;

  const latest = data.latestResult;
  const s = latest?.result_4d?.padStart(4, '0') ?? '????';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center">
          <div className="stat-label">Total Draw</div>
          <div className="stat-value text-amber-400">{data.totalDraws}</div>
          <div className="stat-sub">data tersedia</div>
        </div>
        <div className="card text-center">
          <div className="stat-label">Draw Terakhir</div>
          <div className="stat-value text-white text-xl">{latest?.draw_date ?? '—'}</div>
          <div className="stat-sub">tanggal</div>
        </div>
        <div className="card text-center">
          <div className="stat-label">Top 2D</div>
          <div className="stat-value text-red-400">{data.hot2D[0]?.number ?? '—'}</div>
          <div className="stat-sub">paling sering</div>
        </div>
        <div className="card text-center">
          <div className="stat-label">Overdue 2D</div>
          <div className="stat-value text-blue-400">{data.overdue2D[0]?.number ?? '—'}</div>
          <div className="stat-sub">paling tertunggak</div>
        </div>
      </div>

      {latest && (
        <div className="card">
          <div className="card-header">🎰 Hasil Draw Terakhir <span className="text-xs text-slate-500 ml-auto">{latest.draw_date}</span></div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-2">
              {s.split('').map((d, i) => (
                <div key={i} className={`digit-ball ${['ball-as','ball-kop','ball-kep','ball-ekor'][i]}`}>{d}</div>
              ))}
            </div>
            <div className="text-sm text-slate-400 leading-7">
              <div>AS: <strong className="text-slate-200">{s[0]}</strong> · KOP: <strong className="text-slate-200">{s[1]}</strong></div>
              <div>KEPALA: <strong className="text-slate-200">{s[2]}</strong> · EKOR: <strong className="text-slate-200">{s[3]}</strong></div>
              <div>2D: <strong className="text-amber-400">{latest.result_2d}</strong> · 3D: <strong className="text-amber-400">{latest.result_3d}</strong></div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">🔥 Top 2D Terpanas</div>
          <div className="space-y-2 mt-1">
            {data.hot2D.slice(0, 8).map(n => (
              <BarRow key={n.number} label={n.number} value={n.count} max={data.hot2D[0]?.count ?? 1} color="#ef4444" />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">❄️ 2D Overdue (Tertunggak)</div>
          <div className="flex flex-wrap gap-2 mt-1">
            {data.overdue2D.slice(0, 12).map(n => (
              <div key={n.number} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-blue-700 flex items-center justify-center font-bold text-blue-300 text-sm">{n.number}</div>
                <div className="text-xs text-slate-500">{n.lastDrawsAgo}x</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">📊 Analisis per Posisi (AS · KOP · KEPALA · EKOR)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                <th className="text-left py-2 pr-4">Posisi</th>
                <th className="text-left py-2 pr-4">Terpanas</th>
                <th className="text-left py-2 pr-4">Terdingin</th>
                <th className="text-left py-2">Paling Sering</th>
              </tr>
            </thead>
            <tbody>
              {data.posStats.map(ps => (
                <tr key={ps.pos} className="border-b border-slate-800/50 hover:bg-white/2">
                  <td className="py-2 pr-4 font-semibold text-slate-300">{ps.label}</td>
                  <td className="py-2 pr-4"><span className="text-red-400 font-bold">{ps.hotDigit.digit}</span> <span className="text-slate-500 text-xs">({ps.hotDigit.count}x)</span></td>
                  <td className="py-2 pr-4"><span className="text-blue-400 font-bold">{ps.coldDigit.digit}</span> <span className="text-slate-500 text-xs">({ps.coldDigit.lastDrawsAgo} lalu)</span></td>
                  <td className="py-2"><span className="text-green-400 font-bold">{ps.freqDigit.digit}</span> <span className="text-slate-500 text-xs">({ps.freqDigit.pct}%)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">📋 10 Draw Terakhir</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                <th className="text-left py-2 pr-3">Tanggal</th>
                <th className="text-left py-2 pr-3">4D</th>
                <th className="text-left py-2 pr-3">3D</th>
                <th className="text-left py-2">2D</th>
              </tr>
            </thead>
            <tbody>
              {data.recentResults.slice(0, 10).map(r => (
                <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/2">
                  <td className="py-2 pr-3 text-slate-400">{r.draw_date}</td>
                  <td className="py-2 pr-3 font-mono font-bold text-white">{r.result_4d.padStart(4,'0')}</td>
                  <td className="py-2 pr-3 font-mono text-amber-400">{r.result_3d}</td>
                  <td className="py-2 font-mono text-green-400">{r.result_2d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
