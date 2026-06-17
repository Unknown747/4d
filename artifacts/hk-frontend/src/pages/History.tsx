import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi, type ResultsData } from '../lib/api';

const PAGE_SIZE = 20;

export default function History() {
  const [page, setPage] = useState(0);

  const { data, isLoading, error } = useQuery<ResultsData>({
    queryKey: ['results', page],
    queryFn: () => fetchApi<ResultsData>(`/results?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`),
    staleTime: 30_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          📋 Riwayat Draw HK
          <span className="text-xs text-slate-500 ml-auto">{data?.total ?? '—'} draw total</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="spinner" /></div>
        ) : error ? (
          <div className="text-red-400 text-center py-12">{String(error)}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-500 text-xs uppercase">
                    <th className="text-left py-2 pr-3">#</th>
                    <th className="text-left py-2 pr-3">Tanggal</th>
                    <th className="text-left py-2 pr-3">4D</th>
                    <th className="text-left py-2 pr-3">3D</th>
                    <th className="text-left py-2 pr-3">2D</th>
                    <th className="text-left py-2">Sumber</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((r, i) => (
                    <tr key={r.id} className="border-b border-slate-800/50 hover:bg-white/2">
                      <td className="py-2 pr-3 text-slate-600 text-xs">{(data.total) - (page * PAGE_SIZE + i)}</td>
                      <td className="py-2 pr-3 text-slate-400">{r.draw_date}</td>
                      <td className="py-2 pr-3 font-mono font-black text-white text-base tracking-wider">{r.result_4d.padStart(4, '0')}</td>
                      <td className="py-2 pr-3 font-mono text-amber-400">{r.result_3d}</td>
                      <td className="py-2 pr-3 font-mono text-green-400">{r.result_2d}</td>
                      <td className="py-2">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${r.source === 'manual' ? 'bg-amber-900/40 text-amber-400' : r.source === 'seed' ? 'bg-blue-900/40 text-blue-400' : 'bg-green-900/40 text-green-400'}`}>
                          {r.source}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-500">
                Halaman {page + 1} dari {totalPages} · {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data?.total ?? 0)} dari {data?.total ?? 0}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-ghost text-sm px-3 py-1.5 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
