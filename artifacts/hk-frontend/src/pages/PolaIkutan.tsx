import { useQuery } from '@tanstack/react-query';
import { fetchApi, type PolaData } from '../lib/api';

function PatternRow({ p, isTop }: { p: PolaData['ekorPatterns'][0]; isTop: boolean }) {
  const pct = p.total > 0 ? Math.round((p.count / p.total) * 100) : 0;
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${isTop ? 'bg-amber-950/20 border border-amber-700/30' : 'bg-slate-800 border border-slate-700'}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-slate-300 text-sm shrink-0">
        {p.fromDigit}
      </div>
      <div className="text-slate-500 text-sm shrink-0">→</div>
      <div className="w-8 h-8 rounded-lg bg-amber-900/30 border border-amber-700/40 flex items-center justify-center font-bold text-amber-400 text-sm shrink-0">
        {p.toDigit}
      </div>
      <div className="flex-1">
        <div className="bg-slate-700 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: isTop ? '#f59e0b' : '#3b82f6' }}
          />
        </div>
      </div>
      <div className="text-xs text-slate-400 w-16 text-right shrink-0">
        <strong className={isTop ? 'text-amber-400' : ''}>{p.count}×</strong> / {p.total}
      </div>
      <div className={`text-xs font-bold px-2 py-0.5 rounded min-w-[36px] text-center ${isTop ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
        {pct}%
      </div>
    </div>
  );
}

export default function PolaIkutan() {
  const { data, isLoading, error } = useQuery<PolaData>({
    queryKey: ['pola-ikutan'],
    queryFn: () => fetchApi<PolaData>('/pola-ikutan'),
    staleTime: 60_000,
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;
  if (error || !data) return <div className="text-red-400 text-center py-20">{String(error)}</div>;

  const s = data.lastResult;
  const topEkors = (data.ekorPatterns || []).slice(0, 3).map(p => p.toDigit);
  const topKepalas = (data.kepalaPatterns || []).slice(0, 3).map(p => p.toDigit);
  const combos = new Set<string>();
  topKepalas.forEach(k => topEkors.forEach(e => combos.add(`${k}${e}`)));

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">
          📌 Hasil Terakhir
          <span className="text-xs text-slate-500 ml-auto">{data.totalPairs} pasang draw dianalisis</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-2">
            <div className="w-12 h-12 rounded-xl bg-blue-900/30 border-2 border-blue-600 flex items-center justify-center font-black text-blue-300 text-xl">{s[0]}</div>
            <div className="w-12 h-12 rounded-xl bg-purple-900/30 border-2 border-purple-600 flex items-center justify-center font-black text-purple-300 text-xl">{s[1]}</div>
            <div className="w-12 h-12 rounded-xl bg-green-900/30 border-2 border-green-600 flex items-center justify-center font-black text-green-300 text-xl">{s[2]}</div>
            <div className="w-12 h-12 rounded-xl bg-amber-900/30 border-2 border-amber-500 flex items-center justify-center font-black text-amber-300 text-xl">{s[3]}</div>
          </div>
          <div className="text-sm text-slate-400 leading-7">
            <div>AS: <strong className="text-blue-300">{s[0]}</strong> · KOP: <strong className="text-purple-300">{s[1]}</strong></div>
            <div>Kepala: <strong className="text-green-300">{s[2]}</strong> · Ekor: <strong className="text-amber-300">{s[3]}</strong></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            🔚 Pola EKOR Ikutan
            <span className="text-xs text-slate-500 ml-auto">Setelah ekor: {data.lastEkor}</span>
          </div>
          <div className="text-xs text-slate-500 mb-3">Setelah ekor {data.lastEkor} keluar, ekor berikut sering muncul:</div>
          {data.ekorPatterns.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-4">Belum cukup data</div>
          ) : (
            <div className="space-y-2">
              {data.ekorPatterns.map((p, i) => <PatternRow key={i} p={p} isTop={i === 0} />)}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            🔙 Pola KEPALA Ikutan
            <span className="text-xs text-slate-500 ml-auto">Setelah kepala: {data.lastKepala}</span>
          </div>
          <div className="text-xs text-slate-500 mb-3">Setelah kepala {data.lastKepala} keluar, kepala berikut sering muncul:</div>
          {data.kepalaPatterns.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-4">Belum cukup data</div>
          ) : (
            <div className="space-y-2">
              {data.kepalaPatterns.map((p, i) => <PatternRow key={i} p={p} isTop={i === 0} />)}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          💡 Rekomendasi 2D dari Pola
          <span className="text-xs text-slate-500 ml-auto">Kepala × Ekor terkuat</span>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {[...combos].map(n => (
            <div
              key={n}
              className="flex flex-col items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 min-w-[64px] hover:border-amber-500 hover:scale-105 transition-all cursor-default"
            >
              <div className="font-black text-white text-2xl leading-none">{n}</div>
              <div className="text-xs text-slate-500">ke·ekor</div>
            </div>
          ))}
          {combos.size === 0 && <div className="text-slate-600 text-sm py-4">Belum cukup data pola</div>}
        </div>
      </div>
    </div>
  );
}
