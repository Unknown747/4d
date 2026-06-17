import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';

interface Prediction {
  number: string;
  count?: number;
  lastDrawsAgo?: number;
  score: number;
  reason: string;
}

interface PredictResult {
  type: string;
  mode: string;
  predictions: Prediction[];
  excludedNumbers?: string[];
  totalDrawsAnalyzed: number;
}

interface GeminiPred {
  number: string;
  score: number;
  reason: string;
}

interface GeminiPredResult {
  type: string;
  result: {
    predictions: GeminiPred[];
    analysis: string;
    method: string;
  };
}

type PredType = '2d' | '3d' | '4d';
type Method = 'statistik' | 'gemini' | 'kombinasi';

const METHOD_LABELS: Record<Method, { label: string; icon: string; color: string }> = {
  statistik: { label: 'Statistik', icon: '📊', color: 'border-blue-600 text-blue-300 bg-blue-900/20' },
  gemini: { label: 'Gemini AI', icon: '🤖', color: 'border-violet-600 text-violet-300 bg-violet-900/20' },
  kombinasi: { label: 'Kombinasi', icon: '⚡', color: 'border-amber-500 text-amber-300 bg-amber-900/20' },
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#f59e0b' : score >= 60 ? '#7c3aed' : '#1d4ed8';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <div className="text-xs text-slate-500 w-8 text-right">{score}</div>
    </div>
  );
}

export default function Prediksi() {
  const [predType, setPredType] = useState<PredType>('2d');
  const [method, setMethod] = useState<Method>('statistik');
  const [geminiContext, setGeminiContext] = useState('');
  const [geminiResult, setGeminiResult] = useState<GeminiPredResult | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState('');

  // Statistik predictions
  const hotQ = useQuery<PredictResult>({
    queryKey: ['predict', predType, 'hot'],
    queryFn: () => fetchApi<PredictResult>(`/predict?type=${predType}&mode=hot`),
    staleTime: 60_000,
  });

  const coldQ = useQuery<PredictResult>({
    queryKey: ['predict', predType, 'cold'],
    queryFn: () => fetchApi<PredictResult>(`/predict?type=${predType}&mode=cold`),
    staleTime: 60_000,
  });

  const balQ = useQuery<PredictResult>({
    queryKey: ['predict', predType, 'balanced'],
    queryFn: () => fetchApi<PredictResult>(`/predict?type=${predType}&mode=balanced`),
    staleTime: 60_000,
  });

  const loading = hotQ.isLoading || coldQ.isLoading || balQ.isLoading;

  async function handleGeminiPredict() {
    setGeminiLoading(true);
    setGeminiError('');
    try {
      const result = await fetchApi<GeminiPredResult>('/gemini/predict', {
        method: 'POST',
        body: JSON.stringify({ type: predType, context: geminiContext }),
      });
      setGeminiResult(result);
    } catch (e) {
      setGeminiError(String(e));
    } finally {
      setGeminiLoading(false);
    }
  }

  // Combine stat + gemini for kombinasi
  const kombinasiPreds: Prediction[] = (() => {
    const stat = balQ.data?.predictions ?? [];
    const gem = geminiResult?.result?.predictions ?? [];
    const combined = [
      ...stat.slice(0, 3).map(p => ({ ...p, reason: `📊 ${p.reason}` })),
      ...gem.slice(0, 3).map(p => ({ number: p.number, score: p.score, reason: `🤖 ${p.reason}` })),
    ];
    // deduplicate
    const seen = new Set<string>();
    return combined.filter(p => { if (seen.has(p.number)) return false; seen.add(p.number); return true; });
  })();

  function renderPredictions(preds: Prediction[], method_: Method) {
    if (!preds.length) {
      return <div className="text-slate-500 text-sm py-4 text-center">Belum ada prediksi — klik Generate</div>;
    }
    return (
      <div className="space-y-2">
        {preds.map((p, i) => (
          <div key={p.number + i} className={`flex items-start gap-3 p-3 rounded-xl border ${METHOD_LABELS[method_].color}`}>
            <div className="font-black text-2xl font-mono leading-none mt-0.5 min-w-[3rem] text-center">{p.number}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 leading-relaxed">{p.reason}</div>
              <ScoreBar score={p.score} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="card">
        <div className="card-header">🎯 Generate Prediksi</div>
        <div className="flex flex-wrap gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide font-medium">Tipe Angka</div>
            <div className="flex gap-1.5">
              {(['2d', '3d', '4d'] as PredType[]).map(t => (
                <button key={t} onClick={() => setPredType(t)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold uppercase transition-all ${predType === t ? 'bg-amber-400 text-black' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-amber-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wide font-medium">Metode</div>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(METHOD_LABELS) as Method[]).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${method === m ? 'bg-violet-600 text-white' : 'bg-[#1a2235] border border-[#1e2d45] text-slate-400 hover:border-violet-500'}`}>
                  <span>{METHOD_LABELS[m].icon}</span>
                  <span>{METHOD_LABELS[m].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Statistik */}
      {(method === 'statistik' || method === 'kombinasi') && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: '🔥 Hot Mode', data: hotQ.data, mode: 'hot' },
            { label: '🧊 Cold Mode', data: coldQ.data, mode: 'cold' },
            { label: '⚖️ Balanced Mode', data: balQ.data, mode: 'balanced' },
          ].map(({ label, data, mode }) => (
            <div key={mode} className="card">
              <div className="card-header">{label}</div>
              {loading ? (
                <div className="flex justify-center py-6"><div className="spinner" /></div>
              ) : (
                <>
                  {renderPredictions((data?.predictions ?? []).slice(0, 5), 'statistik')}
                  {data?.excludedNumbers && data.excludedNumbers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1e2d45]">
                      <div className="text-xs text-slate-500 mb-1">Dikecualikan (muncul 14 draw terakhir):</div>
                      <div className="flex flex-wrap gap-1">
                        {data.excludedNumbers.slice(0, 5).map(n => (
                          <span key={n} className="text-xs px-2 py-0.5 rounded bg-red-900/20 border border-red-800 text-red-400 font-mono">{n}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gemini AI */}
      {(method === 'gemini' || method === 'kombinasi') && (
        <div className="card">
          <div className="card-header">🤖 Prediksi Gemini AI</div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              value={geminiContext}
              onChange={e => setGeminiContext(e.target.value)}
              placeholder="Konteks tambahan (opsional, mis: 'fokus angka ganjil')"
              className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500"
            />
            <button onClick={handleGeminiPredict} disabled={geminiLoading}
              className="btn-primary whitespace-nowrap">
              {geminiLoading ? <><span className="spinner !w-4 !h-4" />Analyzing...</> : <><span>🤖</span> Generate AI</>}
            </button>
          </div>

          {geminiError && <div className="text-red-400 text-sm p-3 bg-red-900/20 rounded-lg border border-red-800">{geminiError}</div>}

          {geminiResult && (
            <div className="space-y-4">
              {geminiResult.result.analysis && (
                <div className="text-sm text-slate-400 bg-[#1a2235] rounded-lg p-3 border-l-2 border-violet-500">
                  {geminiResult.result.analysis}
                </div>
              )}
              {renderPredictions(
                geminiResult.result.predictions.map(p => ({ ...p, reason: p.reason })),
                'gemini'
              )}
            </div>
          )}

          {!geminiResult && !geminiLoading && !geminiError && (
            <div className="text-center py-6 text-slate-500 text-sm">
              Klik "Generate AI" untuk mendapatkan prediksi dari Gemini AI
            </div>
          )}
        </div>
      )}

      {/* Kombinasi */}
      {method === 'kombinasi' && geminiResult && (
        <div className="card">
          <div className="card-header">⚡ Kombinasi — Top Picks (Stat + AI)</div>
          {renderPredictions(kombinasiPreds, 'kombinasi')}
        </div>
      )}

      {/* BB Campuran hint */}
      <div className="card bg-gradient-to-r from-[#111827] to-[#0d1929]">
        <div className="flex items-center gap-3">
          <div className="text-2xl">💡</div>
          <div>
            <div className="text-sm font-bold text-slate-200">Gunakan fitur BB Campuran</div>
            <div className="text-xs text-slate-500">Di tab Angka Fix, pilih digit aktif untuk generate semua kombinasi 4D yang mungkin dengan skor tertinggi.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
