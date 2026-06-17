import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type StatsData, type Row, type RekomendasiData, type WinrateData, type SyncStatusData } from '../lib/api';
import { useToast } from '../components/Toast';
import { useMarket, MARKET_INFO } from '../context/MarketContext';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function derive(r4d: string) {
  const s = r4d.padStart(4, '0');
  return { r3d: s.slice(1), r2d: s.slice(2) };
}

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

// ── Sync Panel ────────────────────────────────────────────────────────────────
function SyncPanel() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState<'all' | 'sgp' | 'sdy' | null>(null);
  const qc = useQueryClient();

  const { data, refetch } = useQuery<SyncStatusData>({
    queryKey: ['sync-status'],
    queryFn: () => fetchApi<SyncStatusData>('/sync/status'),
    staleTime: 30_000,
  });

  async function handleSync(mkt?: 'sgp' | 'sdy') {
    setSyncing(mkt ?? 'all');
    try {
      await fetchApi('/sync/run' + (mkt ? `?market=${mkt}` : ''), { method: 'POST' });
      await refetch();
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['results'] });
      qc.invalidateQueries({ queryKey: ['predict'] });
      qc.invalidateQueries({ queryKey: ['rekomendasi'] });
      qc.invalidateQueries({ queryKey: ['winrate'] });
      toast(`Sync ${mkt ? mkt.toUpperCase() : 'SGP + SDY'} selesai`, 'success');
    } catch (e) {
      toast(`Sync gagal: ${String(e)}`, 'error');
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="card border-slate-700/30 bg-[#0d1420]">
      <div className="flex items-center gap-2 mb-3">
        <div className="font-bold text-slate-300 text-sm">🔄 Status Sinkronisasi</div>
        <button
          onClick={() => handleSync()}
          disabled={!!syncing}
          className="ml-auto btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
        >
          {syncing === 'all'
            ? <><span className="spinner !w-3 !h-3" /> Sync...</>
            : '🔄 Sync Semua'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(['sgp', 'sdy'] as const).map(m => {
          const mi = MARKET_INFO[m];
          const stat = data?.[m];
          const missing = data?.missingDates?.[m] ?? 0;
          return (
            <div key={m} className={`rounded-xl border p-3 ${m === 'sgp' ? 'border-red-900/40 bg-red-950/10' : 'border-amber-900/40 bg-amber-950/10'}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{mi.flag}</span>
                <span className={`font-bold text-xs ${m === 'sgp' ? 'text-red-400' : 'text-amber-400'}`}>{mi.short}</span>
                {missing > 0 && (
                  <span className="ml-auto text-xs bg-orange-900/40 text-orange-400 border border-orange-800/40 px-1.5 py-0.5 rounded-full">
                    {missing} pending
                  </span>
                )}
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total draw</span>
                  <span className="text-slate-300 font-bold">{stat?.total ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Terakhir</span>
                  <span className="text-slate-300 font-mono text-xs">{stat?.lastDate ?? '—'}</span>
                </div>
              </div>
              <button
                onClick={() => handleSync(m)}
                disabled={!!syncing}
                className="mt-2 w-full text-xs py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1"
              >
                {syncing === m
                  ? <><span className="spinner !w-3 !h-3" /> Syncing...</>
                  : `↻ Sync ${mi.short}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 text-xs text-slate-600 text-center">
        Auto-sync: SGP (Sen·Rab·Kam·Sab·Min 23:05 WIB) · SDY (setiap hari 23:05 WIB)
      </div>
    </div>
  );
}

// ── Rekomendasi Hari Ini ─────────────────────────────────────────────────────
function RekomendasiHariIni() {
  const { toast } = useToast();
  const { market } = useMarket();
  const mi = MARKET_INFO[market];

  const { data, isLoading, error } = useQuery<RekomendasiData>({
    queryKey: ['rekomendasi', market],
    queryFn: () => fetchApi<RekomendasiData>(`/rekomendasi?market=${market}`),
    staleTime: 120_000,
  });

  const unique3D = [...new Set(data?.predictions.map(p => p.num3d) ?? [])];
  const unique2D = [...new Set(data?.predictions.map(p => p.num2d) ?? [])];

  function handleCopy() {
    if (!data) return;
    const lines = [
      `🎯 Rekomendasi ${mi.short} Toto — ${data.tanggal}`,
      `Angka Kuat: ${data.angkaKuat.join(' · ')}`,
      `Confidence: ${data.confidence}%`,
      '',
      `No  | 4D   | 3D  | 2D`,
      ...data.predictions.map(p => `${String(p.rank).padStart(2,'0')}  | ${p.num4d} | ${p.num3d} | ${p.num2d}`),
      '',
      `3D Pasang: ${unique3D.join(' · ')}`,
      `2D Pasang: ${unique2D.join(' · ')}`,
      '',
      `Sinyal: Shio (${data.signals.shioBonus.join(', ')}) · Ekor ikut (${data.signals.ekorBonus.join(',')})`,
    ].join('\n');
    navigator.clipboard.writeText(lines).then(() => toast('Disalin ke clipboard!', 'success'));
  }

  if (isLoading) return (
    <div className="card border-amber-500/40 bg-gradient-to-br from-[#0d1b2a] to-[#111827]">
      <div className="card-header">🎯 Rekomendasi Hari Ini</div>
      <div className="flex justify-center py-8"><div className="spinner" /></div>
    </div>
  );

  if (error || !data) return (
    <div className="card border-red-500/30">
      <div className="card-header">🎯 Rekomendasi Hari Ini</div>
      <div className="text-red-400 text-sm py-4 text-center">Tambahkan minimal 5 data draw untuk melihat rekomendasi.</div>
    </div>
  );

  const BALL_COLORS = ['#f59e0b','#ef4444','#3b82f6','#10b981','#a855f7'];

  return (
    <div className="card border-amber-500/40 bg-gradient-to-br from-[#0d1420] to-[#0f1a2e]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-amber-400 font-bold text-lg tracking-wide">🎯 Rekomendasi Hari Ini</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {mi.flag} {mi.short} · Gabungan sinyal: Posisi · Shio · Pola Ikutan &nbsp;·&nbsp; {data.signals.totalDraws} draw
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium transition-colors"
        >
          📋 Copy Semua
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-slate-500 shrink-0">Confidence</span>
        <div className="flex-1 bg-slate-700/60 rounded-full h-2">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${data.confidence}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }} />
        </div>
        <span className="text-amber-400 font-bold text-sm shrink-0">{data.confidence}%</span>
      </div>

      <div className="mb-4">
        <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">5 Angka Kuat (BB)</div>
        <div className="flex gap-2 flex-wrap">
          {data.angkaKuat.map((d, i) => (
            <div key={d} className="w-11 h-11 rounded-full flex items-center justify-center font-black text-xl text-white shadow-lg"
              style={{ background: `${BALL_COLORS[i]}22`, border: `2px solid ${BALL_COLORS[i]}`, color: BALL_COLORS[i] }}>
              {d}
            </div>
          ))}
          <div className="flex items-center text-xs text-slate-500 ml-2">→ kombinasi 4D di bawah</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {data.signals.shioBonus.map(s => (
          <span key={s} className="px-2 py-0.5 bg-purple-900/40 border border-purple-700/50 rounded text-purple-300 text-xs">🔮 {s}</span>
        ))}
        {data.signals.ekorBonus.map(e => (
          <span key={e} className="px-2 py-0.5 bg-blue-900/40 border border-blue-700/50 rounded text-blue-300 text-xs">🎯 Ekor {e}</span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 border-b border-slate-700 text-slate-400 text-xs uppercase">
              <th className="text-center py-2 px-3 w-8">#</th>
              <th className="text-center py-2 px-3">4D</th>
              <th className="text-center py-2 px-3">3D</th>
              <th className="text-center py-2 px-3">2D</th>
            </tr>
          </thead>
          <tbody>
            {data.predictions.map((p, i) => (
              <tr key={p.num4d} className={`border-b border-slate-800/50 transition-colors hover:bg-white/3 ${i === 0 ? 'bg-amber-500/5' : ''}`}>
                <td className="text-center py-2 px-3 text-slate-500 text-xs">{p.rank}</td>
                <td className="text-center py-2 px-3">
                  <span className={`font-black font-mono text-base tracking-widest ${i === 0 ? 'text-amber-400' : 'text-white'}`}>{p.num4d}</span>
                  {i === 0 && <span className="ml-1.5 text-xs text-amber-500/80">★</span>}
                </td>
                <td className="text-center py-2 px-3 font-mono text-amber-300/80 text-sm">{p.num3d}</td>
                <td className="text-center py-2 px-3 font-mono text-green-400/80 text-sm">{p.num2d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">🎲 3D Pasang</span>
            <span className="text-xs text-slate-500">{unique3D.length} angka</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unique3D.map(n => (
              <span key={n} className="font-mono font-bold text-sm px-2 py-0.5 bg-amber-900/30 border border-amber-700/40 rounded text-amber-300">{n}</span>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">🎲 2D Pasang</span>
            <span className="text-xs text-slate-500">{unique2D.length} angka</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unique2D.map(n => (
              <span key={n} className="font-mono font-bold text-sm px-2 py-0.5 bg-green-900/30 border border-green-700/40 rounded text-green-300">{n}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-600 mt-3 text-center">
        3D &amp; 2D diekstrak dari semua 10 prediksi 4D · Diperbarui setiap ada data baru
      </div>
    </div>
  );
}

// ── Win Rate Tracker ─────────────────────────────────────────────────────────
function WinRateTracker() {
  const { market } = useMarket();
  const { data, isLoading } = useQuery<WinrateData>({
    queryKey: ['winrate', market],
    queryFn: () => fetchApi<WinrateData>(`/rekomendasi/winrate?market=${market}`),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="card border-slate-700/40">
      <div className="card-header">📈 Win Rate Rekomendasi</div>
      <div className="flex justify-center py-4"><div className="spinner" /></div>
    </div>
  );
  if (!data) return null;

  const { winrate, history, totalChecked } = data;

  const WRBar = ({ label, wr, color }: { label: string; wr: { hits: number; total: number; pct: number }; color: string }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</span>
        <span className="font-black text-lg" style={{ color }}>{wr.total > 0 ? `${wr.pct}%` : '—'}</span>
      </div>
      <div className="bg-slate-700/60 rounded-full h-2.5">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: wr.total > 0 ? `${wr.pct}%` : '0%', background: color }} />
      </div>
      <div className="text-xs text-slate-500">{wr.hits}/{wr.total} tembus</div>
    </div>
  );

  const checked = history.filter(h => h.checked);

  return (
    <div className="card border-slate-700/40">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-bold text-slate-200">📈 Win Rate Rekomendasi</div>
          <div className="text-xs text-slate-500 mt-0.5">{totalChecked} draw sudah diverifikasi · otomatis saat input result baru</div>
        </div>
      </div>

      {totalChecked === 0 ? (
        <div className="text-center py-6 text-slate-500 text-sm">
          Belum ada data yang diverifikasi.<br />
          <span className="text-xs">Input result baru untuk mulai melacak win rate.</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <WRBar label="4D" wr={winrate['4d']} color="#f59e0b" />
            <WRBar label="3D" wr={winrate['3d']} color="#3b82f6" />
            <WRBar label="2D" wr={winrate['2d']} color="#10b981" />
          </div>
          {checked.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-700/40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700/50 text-slate-500 uppercase">
                    <th className="text-left py-2 px-3">Tanggal</th>
                    <th className="text-left py-2 px-3">Top Prediksi</th>
                    <th className="text-left py-2 px-3">Hasil Aktual</th>
                    <th className="text-center py-2 px-2">4D</th>
                    <th className="text-center py-2 px-2">3D</th>
                    <th className="text-center py-2 px-2">2D</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.slice(0, 10).map((h, i) => (
                    <tr key={i} className="border-b border-slate-800/40 hover:bg-white/2">
                      <td className="py-2 px-3 text-slate-400">{h.based_on_date}</td>
                      <td className="py-2 px-3 font-mono text-slate-300">{h.top3_4d.join(', ')}</td>
                      <td className="py-2 px-3 font-mono font-bold text-white">{h.actual_4d}</td>
                      <td className="text-center py-2 px-2">{h.hit_4d ? <span className="text-green-400 font-bold">✓</span> : <span className="text-slate-600">✗</span>}</td>
                      <td className="text-center py-2 px-2">{h.hit_3d ? <span className="text-green-400 font-bold">✓</span> : <span className="text-slate-600">✗</span>}</td>
                      <td className="text-center py-2 px-2">{h.hit_2d ? <span className="text-green-400 font-bold">✓</span> : <span className="text-slate-600">✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Quick Input ──────────────────────────────────────────────────────────────
function QuickInput({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
  const { market } = useMarket();
  const mi = MARKET_INFO[market];
  const [date, setDate] = useState(todayStr());
  const [angka, setAngka] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const preview = angka.length >= 2 ? derive(angka.padStart(4, '0')) : null;

  async function handleSave() {
    if (!/^\d{1,4}$/.test(angka)) { toast('Angka harus 1–4 digit', 'warning'); return; }
    if (!date) { toast('Tanggal wajib diisi', 'warning'); return; }
    setSaving(true);
    try {
      const saved = await fetchApi<Row>('/results', {
        method: 'POST',
        body: JSON.stringify({ draw_date: date, result_4d: angka, market }),
      });
      toast(`${mi.short} Tersimpan: ${saved.result_4d} · 3D: ${saved.result_3d} · 2D: ${saved.result_2d}`, 'success');
      setAngka('');
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      setDate(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`);
      onSaved();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (e) {
      toast(`Gagal menyimpan: ${String(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card border-slate-600/30 bg-[#0d1420]">
      <div className="card-header">
        ➕ Input Result {mi.flag} {mi.short}
        <span className="ml-auto text-xs text-slate-500">Update manual setelah draw keluar</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium">Tanggal</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-40" />
        </div>
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium">Nomor 4D (0000–9999)</label>
          <div className="flex gap-2">
            <input ref={inputRef} type="text" inputMode="numeric" pattern="\d{1,4}" maxLength={4}
              value={angka} onChange={e => setAngka(e.target.value.replace(/\D/g,'').slice(0,4))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="contoh: 1064"
              className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-xl font-black font-mono text-white tracking-widest text-center focus:outline-none focus:border-amber-500" />
            <button onClick={handleSave} disabled={saving || angka.length === 0} className="btn-primary px-5 text-base disabled:opacity-40">
              {saving ? <span className="spinner !w-4 !h-4" /> : '💾 Simpan'}
            </button>
          </div>
        </div>
      </div>

      {angka.length > 0 && (
        <div className="flex items-center gap-3 mt-3">
          <div className="flex gap-2">
            {angka.padStart(4,'0').split('').map((d, i) => (
              <div key={i} className={`digit-ball !w-10 !h-10 !text-base ${['ball-as','ball-kop','ball-kep','ball-ekor'][i]}`}>{d}</div>
            ))}
          </div>
          {preview && (
            <div className="flex gap-3 text-sm text-slate-400">
              <span>3D: <strong className="text-amber-400 font-mono">{preview.r3d}</strong></span>
              <span>2D: <strong className="text-green-400 font-mono">{preview.r2d}</strong></span>
              <span>KEPALA: <strong className="text-slate-200 font-mono">{angka.padStart(4,'0')[2]}</strong></span>
              <span>EKOR: <strong className="text-slate-200 font-mono">{angka.padStart(4,'0')[3]}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const qc = useQueryClient();
  const { market } = useMarket();

  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats', market],
    queryFn: () => fetchApi<StatsData>(`/stats?market=${market}`),
    staleTime: 60_000,
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['results'] });
    qc.invalidateQueries({ queryKey: ['predict'] });
    qc.invalidateQueries({ queryKey: ['rekomendasi'] });
    qc.invalidateQueries({ queryKey: ['winrate'] });
    qc.invalidateQueries({ queryKey: ['sync-status'] });
  }

  const latest = data?.latestResult;
  const s = latest?.result_4d?.padStart(4, '0') ?? '????';

  return (
    <div className="space-y-4">
      <RekomendasiHariIni />
      <WinRateTracker />
      <SyncPanel />

      {data && (
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
      )}
      {isLoading && <div className="flex justify-center py-6"><div className="spinner" /></div>}
      {error && <div className="text-red-400 text-center py-4 text-sm">{String(error)}</div>}

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

      {data && (
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
      )}

      {data && (
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
      )}

      {data && (
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
      )}

      <QuickInput onSaved={handleSaved} />
    </div>
  );
}
