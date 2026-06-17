import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi, type StatsData, type Row } from '../lib/api';
import { useToast } from '../components/Toast';

// Today's date in YYYY-MM-DD format (local timezone)
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

function QuickInput({ onSaved }: { onSaved: () => void }) {
  const { toast } = useToast();
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
        body: JSON.stringify({ draw_date: date, result_4d: angka }),
      });
      toast(`Tersimpan: ${saved.result_4d} · 3D: ${saved.result_3d} · 2D: ${saved.result_2d}`, 'success');
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
    <div className="card border-amber-500/30 bg-gradient-to-r from-[#111827] to-[#0d1b2a]">
      <div className="card-header">
        ➕ Input Result Hari Ini
        <span className="ml-auto text-xs text-slate-500">Update manual setelah draw keluar</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Date picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-40"
          />
        </div>

        {/* 4D input */}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-slate-500 uppercase tracking-wide font-medium">Nomor 4D (0000–9999)</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="\d{1,4}"
              maxLength={4}
              value={angka}
              onChange={e => setAngka(e.target.value.replace(/\D/g,'').slice(0,4))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="contoh: 1064"
              className="flex-1 bg-[#1a2235] border border-[#1e2d45] rounded-lg px-3 py-2 text-xl font-black font-mono text-white tracking-widest text-center focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSave}
              disabled={saving || angka.length === 0}
              className="btn-primary px-5 text-base disabled:opacity-40"
            >
              {saving ? <span className="spinner !w-4 !h-4" /> : '💾 Simpan'}
            </button>
          </div>
        </div>
      </div>

      {/* Live preview */}
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

export default function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: () => fetchApi<StatsData>('/stats'),
    staleTime: 60_000,
  });

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: ['results'] });
    qc.invalidateQueries({ queryKey: ['predict'] });
  }

  if (isLoading) return (
    <div className="space-y-4">
      <QuickInput onSaved={handleSaved} />
      <div className="flex justify-center py-12"><div className="spinner" /></div>
    </div>
  );
  if (error || !data) return (
    <div className="space-y-4">
      <QuickInput onSaved={handleSaved} />
      <div className="text-red-400 text-center py-8">{String(error)}</div>
    </div>
  );

  const latest = data.latestResult;
  const s = latest?.result_4d?.padStart(4, '0') ?? '????';

  return (
    <div className="space-y-4">

      {/* ── Quick Input ── */}
      <QuickInput onSaved={handleSaved} />

      {/* ── Stats Row ── */}
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

      {/* ── Latest Result ── */}
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

      {/* ── Hot & Overdue ── */}
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

      {/* ── Positional Analysis ── */}
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

      {/* ── Recent 10 ── */}
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
