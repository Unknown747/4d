const BASE = '/api';
let statsCache = null;
let historyPage = 0;
const PAGE_SIZE = 15;
let historyTotal = 0;
let currentPredictType = '4d';
let currentPredictMode = 'hot';

// ─── Utility ───────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function copyNum(num, btn) {
  navigator.clipboard.writeText(num).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
  }).catch(() => toast('Gagal copy', 'error'));
}

function copyAll(nums, btn) {
  const text = nums.join('\n');
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Tersalin!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  }).catch(() => toast('Gagal copy', 'error'));
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = document.createElement('span');
  icon.textContent = type === 'success' ? '✅' : '❌';
  const text = document.createElement('span');
  text.textContent = msg;
  el.appendChild(icon);
  el.appendChild(text);
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function fmt4d(s) {
  return String(s ?? '').padStart(4, '0');
}

function get3d(s) { return fmt4d(s).slice(1); }
function get2d(s) { return fmt4d(s).slice(2); }
function getAs(s) { return fmt4d(s).slice(0, 2); }
function getKop(s) { return fmt4d(s).slice(1, 3); }
function getKep(s) { return fmt4d(s)[2]; }
function getEkr(s) { return fmt4d(s)[3]; }

// ─── Navigation ────────────────────────────────────────────────

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  prediksi: '🎯 Prediksi',
  analisis: '🔬 Analisis',
  history: '📋 History',
  bb: '🎰 BB Campuran',
  input: '➕ Input',
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));

  document.getElementById('page-' + id)?.classList.add('active');

  // Activate desktop nav
  document.querySelectorAll('.nav-tab').forEach(t => {
    const txt = t.textContent.toLowerCase();
    if (txt.includes(id.slice(0, 4))) t.classList.add('active');
  });

  // Activate bottom nav
  document.querySelectorAll('.bottom-tab').forEach(t => {
    if (t.getAttribute('onclick')?.includes(id)) t.classList.add('active');
  });

  // Mobile header title
  const titleEl = document.getElementById('mobile-page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[id] || id;

  // Lazy load
  if (id === 'analisis' && statsCache) renderAnalysis(statsCache);
  if (id === 'analisis' && !statsCache) loadStats().then(() => renderAnalysis(statsCache));
  if (id === 'history') { historyPage = 0; loadHistory(); }
  if (id === 'prediksi') { loadAccuracy(); loadPredictions(); }
  if (id === 'bb') generateBB();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Stats & Dashboard ─────────────────────────────────────────

async function loadStats() {
  try {
    const data = await api('/stats');
    statsCache = data;
    renderDashboard(data);
  } catch (e) {
    toast('Gagal memuat data: ' + e.message, 'error');
  }
}

function renderDashboard(data) {
  // Hero latest result
  const r = data.latestResult;
  if (r) {
    const s = fmt4d(r.result_4d);
    const posColors = ['d0', 'd1', 'd2', 'd3'];
    const posNames = ['AS', 'KOP', 'KEP', 'EKR'];

    document.getElementById('hero-date').textContent = formatDate(r.draw_date);
    document.getElementById('hero-4d').innerHTML = s.split('').map((d, i) =>
      `<div class="digit-box ${posColors[i]}">
        ${escapeHtml(d)}
        <span class="pos-label-sm">${posNames[i]}</span>
      </div>`
    ).join('');

    const s3d = get3d(s), s2d = get2d(s), sas = getAs(s);
    document.getElementById('hero-derived').innerHTML = `
      <div class="derived-chip d4d">4D: <strong>${escapeHtml(s)}</strong></div>
      <div class="derived-chip d3d">3D: <strong>${escapeHtml(s3d)}</strong></div>
      <div class="derived-chip d2d">2D: <strong>${escapeHtml(s2d)}</strong></div>
      <div class="derived-chip das">AS: <strong>${escapeHtml(sas)}</strong></div>
    `;

    document.getElementById('hero-detail').innerHTML = `
      <div class="detail-item">
        <div class="detail-label">KEPALA</div>
        <div class="detail-value text-accent">${escapeHtml(getKep(s))}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">EKOR</div>
        <div class="detail-value text-green">${escapeHtml(getEkr(s))}</div>
      </div>
      <div class="detail-item">
        <div class="detail-label">KOP</div>
        <div class="detail-value text-blue">${escapeHtml(getKop(s))}</div>
      </div>
    `;

    // Stat cards
    document.getElementById('stat-total').textContent = data.totalDraws;
    document.getElementById('stat-2d-last').textContent = s2d;
    document.getElementById('stat-as-last').textContent = sas;
  }

  // Hot ekor
  if (data.ekorStats) {
    const hotEkor = [...data.ekorStats].sort((a, b) => a.lastDrawsAgo - b.lastDrawsAgo)[0];
    document.getElementById('stat-hot-ekor').textContent = hotEkor?.digit ?? '—';
    document.getElementById('stat-hot-ekor-sub').textContent = hotEkor ? `${hotEkor.count}x dalam data` : '';
  }

  // Hot 2D chips
  renderHot2D(data.hot2D);

  // Overdue 2D chips
  renderOverdue2D(data.overdue2D);

  // Recent results
  renderRecentResults(data.recentResults);
}

function renderHot2D(items) {
  const el = document.getElementById('hot-2d-list');
  if (!el || !items) return;
  el.innerHTML = items.slice(0, 10).map((x, i) => {
    const cls = i === 0 ? 'hot' : i < 3 ? 'warm' : '';
    return `<div class="chip ${cls}">
      <span class="cn">${escapeHtml(x.number)}</span>
      <span class="cs">${x.lastDrawsAgo === 0 ? 'Terbaru' : Number(x.lastDrawsAgo) + 'd lalu'}</span>
    </div>`;
  }).join('');
}

function renderOverdue2D(items) {
  const el = document.getElementById('overdue-2d-list');
  if (!el || !items) return;
  el.innerHTML = items.slice(0, 10).map(x =>
    `<div class="chip overdue">
      <span class="cn">${escapeHtml(x.number)}</span>
      <span class="cs">${Number(x.lastDrawsAgo)} draw lalu</span>
    </div>`
  ).join('');
}

function renderRecentResults(items) {
  const el = document.getElementById('recent-results-list');
  if (!el || !items) return;
  el.innerHTML = items.slice(0, 5).map(r => {
    const s = fmt4d(r.result_4d);
    return `
    <div class="recent-item">
      <span class="recent-date">${escapeHtml(r.draw_date?.slice(5) ?? '—')}</span>
      <div class="recent-nums">
        <span class="result-badge rb-4d">${escapeHtml(s)}</span>
        <span class="result-badge rb-2d">${escapeHtml(r.result_2d)}</span>
      </div>
    </div>
  `;
  }).join('');
}

function formatDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ─── Quick Predict ─────────────────────────────────────────────

async function refreshQuickPredict() {
  const el = document.getElementById('quick-predict-2d');
  el.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await api('/predict?type=2d&mode=hot');
    el.innerHTML = data.predictions.slice(0, 6).map((p, i) =>
      `<div class="predict-chip-2d rank-${i + 1}">
        <span class="num">${escapeHtml(p.number)}</span>
        <span class="rsn">${escapeHtml(p.reason.replace(/[🔥⚡📊🧊📈]/g, '').trim())}</span>
      </div>`
    ).join('');
  } catch (e) {
    const span = document.createElement('span');
    span.className = 'text-muted';
    span.style.fontSize = '12px';
    span.textContent = e.message;
    el.innerHTML = '';
    el.appendChild(span);
  }
}

// ─── Accuracy / Winrate ────────────────────────────────────────

async function loadAccuracy() {
  const statsEl = document.getElementById('winrate-stats');
  const histEl  = document.getElementById('winrate-history');
  const testedEl = document.getElementById('winrate-tested');
  if (!statsEl) return;

  try {
    const data = await api('/accuracy');

    if (!data.enough) {
      statsEl.innerHTML = `<p class="text-muted" style="font-size:13px;padding:0.5rem 0;">${escapeHtml(data.message)}</p>`;
      if (histEl) histEl.innerHTML = '';
      return;
    }

    if (testedEl) testedEl.textContent = `${data.totalTested} draw diuji`;

    // Winrate badges
    const wr = data.winrate;
    const badge = (label, type, obj) => {
      const color = obj.pct >= 50 ? '#22c55e' : obj.pct >= 25 ? '#f59e0b' : '#ef4444';
      const ring  = obj.pct >= 50 ? 'green'  : obj.pct >= 25 ? 'yellow' : 'red';
      return `
        <div class="wr-badge wr-${ring}">
          <div class="wr-type">${label}</div>
          <div class="wr-pct" style="color:${color}">${obj.pct}%</div>
          <div class="wr-detail">${obj.hits} / ${obj.total} tembus</div>
          <div class="wr-sub">Top ${type === '4d' ? 10 : type === '3d' ? 7 : 8} prediksi</div>
        </div>`;
    };

    statsEl.innerHTML = `
      <div class="wr-badges">
        ${badge('🎲 4D', '4d', wr['4d'])}
        ${badge('🎯 3D', '3d', wr['3d'])}
        ${badge('⚡ 2D', '2d', wr['2d'])}
      </div>
      <div class="wr-note">Backtesting: setiap draw diuji terhadap prediksi yang dibuat dari data sebelumnya saja.</div>`;

    // History table
    if (histEl && data.history) {
      histEl.innerHTML = `
        <div class="wr-hist-wrap">
          <table class="wr-hist-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Hasil</th>
                <th>4D</th>
                <th>3D</th>
                <th>2D</th>
              </tr>
            </thead>
            <tbody>
              ${data.history.map(h => `
                <tr>
                  <td class="wr-date">${escapeHtml(h.date)}</td>
                  <td class="wr-actual mono">${escapeHtml(h.actual4d)}</td>
                  <td>${h.hit4d ? '<span class="wr-hit">✓</span>' : '<span class="wr-miss">✗</span>'}</td>
                  <td>${h.hit3d ? '<span class="wr-hit">✓</span>' : '<span class="wr-miss">✗</span>'}</td>
                  <td>${h.hit2d ? '<span class="wr-hit">✓</span>' : '<span class="wr-miss">✗</span>'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }
  } catch(e) {
    if (statsEl) statsEl.innerHTML = `<p style="color:var(--text-muted);font-size:13px;">❌ ${escapeHtml(e.message)}</p>`;
  }
}

// ─── Predict Page ──────────────────────────────────────────────

function setPredictType(btn, type) {
  currentPredictType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPredictions();
}

function setPredictMode(btn, mode) {
  currentPredictMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPredictions();
}

async function loadPredictions() {
  const el = document.getElementById('predict-results');
  const titleEl = document.getElementById('predict-card-title');
  if (!el) return;

  const modeLabels = { hot: 'Mode Hot 🔥', cold: 'Mode Cold 🧊', balanced: 'Mode Balanced ⚖️' };
  const typeLabels = { '4d': '4D', '3d': '3D', '2d': '2D' };
  if (titleEl) titleEl.textContent = `🎯 Prediksi ${typeLabels[currentPredictType]} — ${modeLabels[currentPredictMode]}`;

  el.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await api(`/predict?type=${currentPredictType}&mode=${currentPredictMode}`);
    const analyzedEl = document.getElementById('predict-draws-analyzed');
    if (analyzedEl) analyzedEl.textContent = `${data.totalDrawsAnalyzed} draw dianalisis`;

    // Excluded notice
    let excludedHtml = '';
    if (data.excludedNumbers && data.excludedNumbers.length > 0) {
      const chips = data.excludedNumbers.map(n =>
        `<span class="bb-excluded-chip">${escapeHtml(n)}</span>`
      ).join('');
      excludedHtml = `
        <div class="bb-excluded-notice" style="margin-bottom:10px;">
          <span class="bb-excluded-label">🚫 Dibuang (baru keluar):</span>
          <span class="bb-excluded-chips">${chips}</span>
        </div>`;
    }

    const maxScore = Math.max(...data.predictions.map(p => p.score), 1);
    const allNums = data.predictions.map(p => p.number);

    // Copy All strip
    const copyAllId = 'predict-copy-all-btn';
    const copyAllHtml = `
      <div class="copy-all-strip">
        <span class="copy-all-label">📋 ${data.predictions.length} nomor siap</span>
        <button class="btn-copy-all" id="${copyAllId}" onclick="copyAll(${JSON.stringify(allNums)}, this)">📋 Copy Semua</button>
      </div>`;

    const items = data.predictions.map((p, i) => {
      const is4d = currentPredictType === '4d';
      const numClass = is4d ? '' : 'sm';
      const pct = Math.round((p.score / maxScore) * 100);
      // Derive 3D and 2D from 4D number
      const derived3d = is4d ? p.number.slice(1) : '';
      const derived2d = is4d ? p.number.slice(2) : '';
      const derivedHtml = is4d ? `
        <div class="predict-derived">
          <span class="predict-badge p3d">3D: <strong>${escapeHtml(derived3d)}</strong></span>
          <span class="predict-badge p2d">2D: <strong>${escapeHtml(derived2d)}</strong></span>
        </div>` : '';
      return `
        <div class="predict-item rank-${i + 1}">
          <div class="predict-rank">#${i + 1}</div>
          <div class="predict-num-col">
            <div class="predict-num ${numClass} mono">${escapeHtml(p.number)}</div>
            ${derivedHtml}
          </div>
          <div class="predict-info">
            <div class="predict-reason">${escapeHtml(p.reason)}</div>
            <div class="predict-score-bar">
              <div class="predict-score-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="predict-right">
            <div class="predict-score-label">${Number(p.score)}</div>
            <button class="btn-copy-num" onclick="copyNum('${escapeHtml(p.number)}', this)">⎘</button>
          </div>
        </div>
      `;
    }).join('');

    el.innerHTML = excludedHtml + copyAllHtml + items;
  } catch (e) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1rem;color:var(--text-muted);font-size:13px;';
    div.textContent = '❌ ' + e.message;
    el.innerHTML = '';
    el.appendChild(div);
  }
}

// ─── Analysis Page ─────────────────────────────────────────────

function renderAnalysis(data) {
  if (!data) return;
  renderPosHeatmap(data.posStats);
  renderDigitChart('kepala-chart', data.kepalaStats);
  renderDigitChart('ekor-chart', data.ekorStats);
  render2DTable(data.freq2D);
  render3DChips(data.freq3D);
}

function renderPosHeatmap(posStats) {
  const el = document.getElementById('pos-heatmap');
  if (!el || !posStats) return;
  const maxCount = Math.max(...posStats.flatMap(ps => ps.digits.map(d => d.count)), 1);
  el.innerHTML = posStats.map(ps => {
    const sorted = [...ps.digits].sort((a, b) => b.count - a.count);
    const topDigit = sorted[0]?.digit;
    return `<div class="pos-col">
      ${ps.digits.map(d => {
        const ratio = d.count / maxCount;
        const heat = ratio >= 0.5 ? 5 : ratio >= 0.35 ? 4 : ratio >= 0.22 ? 3 : ratio >= 0.12 ? 2 : ratio > 0.03 ? 1 : 0;
        const isTop = d.digit === topDigit ? 'is-top' : '';
        return `<div class="pos-cell heat-${heat} ${isTop}" title="Digit ${Number(d.digit)}: ${Number(d.count)}x (${Number(d.pct)}%), ${Number(d.lastDrawsAgo)} draw lalu">
          <span class="dc">${Number(d.digit)}</span>
          <span class="dv">${Number(d.count)}x</span>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

function renderDigitChart(elId, stats) {
  const el = document.getElementById(elId);
  if (!el || !stats) return;
  const maxCount = Math.max(...stats.map(d => d.count), 1);
  el.innerHTML = stats.map(d => {
    const pct = (d.count / maxCount * 100).toFixed(0);
    const color = d.lastDrawsAgo < 3 ? '#ef4444' : d.lastDrawsAgo < 8 ? '#f59e0b' : '#3b82f6';
    return `<div class="dfc-row">
      <div class="dfc-label">${Number(d.digit)}</div>
      <div class="dfc-bar">
        <div class="dfc-fill" style="width:${pct}%;background:${color};"></div>
      </div>
      <div class="dfc-val">${Number(d.count)}x</div>
    </div>`;
  }).join('');
}

function render2DTable(items) {
  const tbody = document.getElementById('freq-2d-table');
  if (!tbody || !items) return;
  tbody.innerHTML = items.slice(0, 20).map(x => {
    const status = x.isHot
      ? '<span class="tag tag-hot">Hot</span>'
      : x.isOverdue
      ? '<span class="tag tag-overdue">Overdue</span>'
      : '—';
    return `<tr>
      <td class="mono" style="font-weight:700;font-size:16px;">${escapeHtml(x.number)}</td>
      <td>${Number(x.count)}x</td>
      <td class="${x.lastDrawsAgo > 10 ? 'text-accent' : 'text-muted'}">${x.lastDrawsAgo === 0 ? 'Terbaru' : Number(x.lastDrawsAgo) + ' draw lalu'}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function render3DChips(items) {
  const el = document.getElementById('freq-3d-list');
  if (!el || !items) return;
  el.innerHTML = items.slice(0, 15).map(x =>
    `<div class="chip-lg">
      ${escapeHtml(x.number)}
      <span class="cnt">${Number(x.count)}x · ${Number(x.lastDrawsAgo)}d lalu</span>
    </div>`
  ).join('');
}

// ─── History ───────────────────────────────────────────────────

async function loadHistory() {
  const tbody = document.getElementById('history-table');
  const mobileList = document.getElementById('history-list-mobile');
  const loading = '<div class="loading-spinner"></div>';

  if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;"><div class="loading-spinner" style="margin:1rem auto;"></div></td></tr>';
  if (mobileList) mobileList.innerHTML = loading;

  try {
    const data = await api(`/results?limit=${PAGE_SIZE}&offset=${historyPage * PAGE_SIZE}`);
    historyTotal = data.total;
    const count = document.getElementById('history-count');
    if (count) count.textContent = `${data.total} total`;

    const info = document.getElementById('pager-info');
    if (info) info.textContent = `${historyPage * PAGE_SIZE + 1}–${Math.min((historyPage + 1) * PAGE_SIZE, data.total)} dari ${data.total}`;

    const prev = document.getElementById('pager-prev');
    const next = document.getElementById('pager-next');
    if (prev) prev.disabled = historyPage === 0;
    if (next) next.disabled = (historyPage + 1) * PAGE_SIZE >= data.total;

    // Desktop table
    if (tbody) {
      tbody.innerHTML = data.data.map((r, i) => {
        const s = fmt4d(r.result_4d);
        const srcTag = r.source === 'manual'
          ? '<span class="tag tag-manual">manual</span>'
          : '<span class="tag tag-seed">seed</span>';
        const del = r.source === 'manual'
          ? `<button class="btn btn-danger" onclick="deleteResult(${Number(r.id)})">🗑</button>`
          : '';
        return `<tr>
          <td class="text-muted">${data.total - (historyPage * PAGE_SIZE + i)}</td>
          <td>${escapeHtml(r.draw_date)}</td>
          <td class="mono" style="font-weight:700;font-size:15px;color:var(--accent)">${escapeHtml(s)}</td>
          <td class="mono text-green">${escapeHtml(get3d(s))}</td>
          <td class="mono text-blue">${escapeHtml(get2d(s))}</td>
          <td class="mono">${escapeHtml(getAs(s))}</td>
          <td class="mono">${escapeHtml(getKep(s))}</td>
          <td class="mono">${escapeHtml(getEkr(s))}</td>
          <td>${srcTag}</td>
          <td>${del}</td>
        </tr>`;
      }).join('');
    }

    // Mobile list
    if (mobileList) {
      mobileList.innerHTML = data.data.map(r => {
        const s = fmt4d(r.result_4d);
        const del = r.source === 'manual'
          ? `<button class="btn btn-danger" style="padding:3px 8px;font-size:11px;" onclick="deleteResult(${Number(r.id)})">🗑</button>`
          : '';
        return `<div class="history-card">
          <div>
            <div class="hc-date">${escapeHtml(r.draw_date)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${r.source === 'manual' ? '✏️ manual' : '📦 seed'}</div>
          </div>
          <div class="hc-nums">
            <div class="hc-4d">${escapeHtml(s)}</div>
            <div class="hc-derived">
              <span class="result-badge rb-3d">${escapeHtml(get3d(s))}</span>
              <span class="result-badge rb-2d">${escapeHtml(get2d(s))}</span>
            </div>
          </div>
          <div class="hc-del">${del}</div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    const msg = e.message;
    if (mobileList) {
      const div = document.createElement('div');
      div.style.cssText = 'text-align:center;padding:1rem;color:var(--text-muted);';
      div.textContent = msg;
      mobileList.innerHTML = '';
      mobileList.appendChild(div);
    }
    if (tbody) {
      const td = document.createElement('td');
      td.colSpan = 10;
      td.style.cssText = 'text-align:center;color:var(--text-muted);';
      td.textContent = msg;
      const tr = document.createElement('tr');
      tr.appendChild(td);
      tbody.innerHTML = '';
      tbody.appendChild(tr);
    }
    toast(msg, 'error');
  }
}

function changePage(dir) {
  const newPage = historyPage + dir;
  if (newPage < 0 || newPage * PAGE_SIZE >= historyTotal) return;
  historyPage = newPage;
  loadHistory();
}

async function deleteResult(id) {
  if (!confirm('Hapus result ini?')) return;
  try {
    await api(`/results/${id}`, { method: 'DELETE' });
    toast('Result dihapus');
    statsCache = null;
    loadHistory();
    loadStats();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── Input Form ────────────────────────────────────────────────

function previewDerived() {
  const val = document.getElementById('f-4d')?.value ?? '';
  const preview = document.getElementById('derived-preview');
  if (val.length >= 1) {
    const s = val.padStart(4, '0');
    document.getElementById('prev-3d').textContent = get3d(s);
    document.getElementById('prev-2d').textContent = get2d(s);
    document.getElementById('prev-kep').textContent = s[2] || '?';
    document.getElementById('prev-ekr').textContent = s[3] || '?';
    if (preview) preview.style.display = 'flex';
  } else {
    if (preview) preview.style.display = 'none';
  }
}

async function submitResult(e) {
  e.preventDefault();
  const draw_date = document.getElementById('f-date').value;
  const result_4d = document.getElementById('f-4d').value;

  if (!draw_date || !result_4d) {
    toast('Semua field wajib diisi', 'error');
    return;
  }
  if (!/^\d{1,4}$/.test(result_4d)) {
    toast('Nomor 4D harus berupa angka (0000–9999)', 'error');
    return;
  }

  try {
    const res = await api('/results', {
      method: 'POST',
      body: JSON.stringify({ draw_date, result_4d }),
    });
    const s = fmt4d(res.result_4d);
    toast(`✅ Tersimpan! ${s} → 3D:${get3d(s)} 2D:${get2d(s)}`);
    document.getElementById('add-form').reset();
    document.getElementById('derived-preview').style.display = 'none';
    statsCache = null;
    await loadStats();
    refreshQuickPredict();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── BB Campuran ───────────────────────────────────────────────

let bbManualDigits = new Set();
let bbOverrideOpen = false;

// Render BB results into the list
function renderBBResults(data) {
  const digitsRow = document.getElementById('bb-auto-digits-row');
  const combosEl = document.getElementById('bb-auto-combos');
  const resultList = document.getElementById('bb-results-list');

  if (digitsRow) {
    digitsRow.innerHTML = data.activeDigits.map(d =>
      `<div class="bb-auto-digit-chip">${d}</div>`
    ).join('');
  }
  if (combosEl) {
    combosEl.textContent = `${data.totalCombinations} kombinasi · ${data.totalDrawsAnalyzed} draw`;
  }

  if (resultList) {
    // Excluded notice
    let excludedHtml = '';
    if (data.excludedNumbers && data.excludedNumbers.length > 0) {
      const chips = data.excludedNumbers.map(n =>
        `<span class="bb-excluded-chip">${escapeHtml(n)}</span>`
      ).join('');
      excludedHtml = `
        <div class="bb-excluded-notice">
          <span class="bb-excluded-label">🚫 Dibuang (baru keluar):</span>
          <span class="bb-excluded-chips">${chips}</span>
        </div>`;
    }

    const allNums = data.predictions.map(p => p.number);
    const copyAllHtml = `
      <div class="copy-all-strip">
        <span class="copy-all-label">📋 ${allNums.length} nomor siap</span>
        <button class="btn-copy-all" onclick="copyAll(${JSON.stringify(allNums)}, this)">📋 Copy Semua</button>
      </div>`;

    const items = data.predictions.map((p, i) =>
      `<div class="bb-result-item">
        <div class="bb-rank">#${i + 1}</div>
        <div class="bb-nums">
          <div class="bb-4d">${escapeHtml(p.number)}</div>
          <div class="bb-derived">
            <span class="bb-badge b3d">3D: ${escapeHtml(p.result3d)}</span>
            <span class="bb-badge b2d">2D: ${escapeHtml(p.result2d)}</span>
          </div>
        </div>
        <div class="bb-score-col">
          <div class="bb-score-num">${p.score}</div>
          <div class="bb-reason">${escapeHtml(p.reason)}</div>
        </div>
        <button class="btn-copy-num" onclick="copyNum('${escapeHtml(p.number)}', this)">⎘</button>
      </div>`
    ).join('');

    resultList.innerHTML = excludedHtml + copyAllHtml + items;
  }
}

// Auto-mode: let server pick digits
async function generateBB() {
  const resultList = document.getElementById('bb-results-list');
  const digitsRow = document.getElementById('bb-auto-digits-row');
  if (resultList) resultList.innerHTML = '<div class="loading-spinner" style="margin:1.5rem auto;"></div>';
  if (digitsRow) digitsRow.innerHTML = '<div class="loading-spinner" style="width:16px;height:16px;"></div>';

  try {
    const data = await api(`/bb-campuran`);
    renderBBResults(data);

    // Sync manual digit grid to show what auto picked
    syncManualGridToDigits(data.activeDigits);
  } catch (e) {
    if (resultList) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:1rem;color:var(--text-muted);font-size:13px;text-align:center;';
      div.textContent = '❌ ' + e.message;
      resultList.innerHTML = '';
      resultList.appendChild(div);
    }
    toast(e.message, 'error');
  }
}

// Manual-override: use user-selected digits
async function generateBBManual() {
  const sorted = [...bbManualDigits].sort((a, b) => a - b);
  if (sorted.length < 2) {
    toast('Pilih minimal 2 digit aktif', 'error');
    return;
  }

  const resultList = document.getElementById('bb-results-list');
  const digitsRow = document.getElementById('bb-auto-digits-row');
  if (resultList) resultList.innerHTML = '<div class="loading-spinner" style="margin:1.5rem auto;"></div>';
  if (digitsRow) digitsRow.innerHTML = '<div class="loading-spinner" style="width:16px;height:16px;"></div>';

  try {
    const data = await api(`/bb-campuran?digits=${sorted.join('')}`);
    renderBBResults(data);
  } catch (e) {
    if (resultList) {
      const div = document.createElement('div');
      div.style.cssText = 'padding:1rem;color:var(--text-muted);font-size:13px;text-align:center;';
      div.textContent = '❌ ' + e.message;
      resultList.innerHTML = '';
      resultList.appendChild(div);
    }
    toast(e.message, 'error');
  }
}

function resetBBToAuto() {
  generateBB();
}

// Sync the manual digit grid buttons to reflect a given list of active digits
function syncManualGridToDigits(activeList) {
  bbManualDigits = new Set(activeList);
  document.querySelectorAll('.bb-digit-btn').forEach(btn => {
    const d = parseInt(btn.dataset.digit);
    if (bbManualDigits.has(d)) {
      btn.classList.add('active');
      btn.classList.remove('dead');
    } else {
      btn.classList.remove('active');
      btn.classList.add('dead');
    }
  });
  updateBBManualSummary();
}

function toggleBBDigit(digit, btn) {
  if (bbManualDigits.has(digit)) {
    bbManualDigits.delete(digit);
    btn.classList.remove('active');
    btn.classList.add('dead');
  } else {
    bbManualDigits.add(digit);
    btn.classList.remove('dead');
    btn.classList.add('active');
  }
  updateBBManualSummary();
}

function updateBBManualSummary() {
  const el = document.getElementById('bb-selected-text');
  if (!el) return;
  const sorted = [...bbManualDigits].sort((a, b) => a - b);
  if (sorted.length === 0) {
    el.textContent = 'Belum ada digit dipilih';
    return;
  }
  const dead = [0,1,2,3,4,5,6,7,8,9].filter(d => !bbManualDigits.has(d));
  const n = sorted.length;
  el.innerHTML = `Aktif: <strong>${sorted.join(' ')}</strong> &nbsp;·&nbsp; Mati: ${dead.join(' ')||'—'} &nbsp;·&nbsp; ${n*n*n*n} kombinasi`;
}

function toggleBBOverride() {
  bbOverrideOpen = !bbOverrideOpen;
  document.getElementById('bb-override-panel').style.display = bbOverrideOpen ? 'block' : 'none';
  document.getElementById('bb-override-toggle-label').textContent = bbOverrideOpen ? 'Tutup ▲' : 'Buka ▼';
}

function initBBDigitGrid() {
  const grid = document.getElementById('bb-digit-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let d = 0; d <= 9; d++) {
    const btn = document.createElement('button');
    btn.className = 'bb-digit-btn';
    btn.textContent = d;
    btn.dataset.digit = d;
    btn.onclick = () => toggleBBDigit(d, btn);
    grid.appendChild(btn);
  }
}

// ─── Init ──────────────────────────────────────────────────────

// Set today's date
document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

initBBDigitGrid();

(async function init() {
  await loadStats();
  refreshQuickPredict();
})();
