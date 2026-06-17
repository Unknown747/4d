const BASE = '/api';
let currentMode = 'balanced';
let historyPage = 0;
const PAGE_SIZE = 20;
let historyTotal = 0;
let statsCache = null;

// ─── Utility ───────────────────────────────────────────────────────────────

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
  el.innerHTML = `<span>${type === 'success' ? '✅' : '❌'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => {
    if (t.textContent.toLowerCase().includes(id === 'dashboard' ? 'dash' :
        id === 'prediction' ? 'pred' : id === 'heatmap' ? 'heat' :
        id === 'history' ? 'hist' : 'input')) t.classList.add('active');
  });
  if (id === 'heatmap' && statsCache) renderHeatmap(statsCache);
  if (id === 'history') loadHistory();
  if (id === 'prediction') loadPrediction();
}

// ─── Ball rendering ─────────────────────────────────────────────────────────

const BALL_COLORS = ['ball-blue', 'ball-red', 'ball-green', 'ball-purple', 'ball-gold', 'ball-gray'];

function ballColor(n) {
  if (n <= 10) return 'ball-red';
  if (n <= 20) return 'ball-blue';
  if (n <= 30) return 'ball-green';
  if (n <= 40) return 'ball-purple';
  return 'ball-gold';
}

function renderBall(n, size = '', extra = false) {
  const cls = extra ? 'ball-gold' : ballColor(n);
  return `<div class="ball ${size} ${cls}">${n}</div>`;
}

function renderBalls(nums, extra, container, size = '') {
  let html = nums.map(n => renderBall(n, size)).join('');
  if (extra) {
    html += `<div class="extra-separator"></div>`;
    html += renderBall(extra, size, true);
  }
  container.innerHTML = html;
}

// ─── Stats loading ───────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const data = await api('/stats');
    statsCache = data;
    renderDashboard(data);
  } catch (e) {
    toast('Gagal memuat statistik: ' + e.message, 'error');
  }
}

function renderDashboard(data) {
  document.getElementById('stat-total').textContent = data.totalDraws;

  const hot = data.hot[0];
  const cold = data.cold[0];
  document.getElementById('stat-hotnum').textContent = hot?.number ?? '—';
  document.getElementById('stat-hotfreq').textContent = hot ? `muncul ${hot.frequency}x (${hot.pct}%)` : '';
  document.getElementById('stat-coldnum').textContent = cold?.number ?? '—';
  document.getElementById('stat-coldfreq').textContent = cold ? `muncul ${cold.frequency}x (${cold.pct}%)` : '';

  if (data.latestDraw) {
    const d = data.latestDraw;
    document.getElementById('stat-lastdate').textContent = d.draw_date;
    document.getElementById('stat-period').textContent = d.period ? `Periode ${d.period}` : 'Terbaru';
    document.getElementById('last-draw-date').textContent = d.draw_date;
    const nums = [d.n1, d.n2, d.n3, d.n4, d.n5, d.n6];
    renderBalls(nums, d.extra, document.getElementById('last-draw-balls'), 'ball-lg');
    const extraEl = document.getElementById('last-draw-extra');
    if (d.extra) {
      extraEl.innerHTML = `<span class="text-xs text-muted">Extra: </span>${renderBall(d.extra, 'ball-sm', true)}`;
    }
  }

  renderFreqBars('hot-list', data.hot, '#ef4444', data.totalDraws);
  renderFreqBars('cold-list', data.cold, '#3b82f6', data.totalDraws);

  const overdueEl = document.getElementById('overdue-list');
  overdueEl.innerHTML = data.overdue.map(o =>
    `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      ${renderBall(o.number, '')}
      <span class="text-xs text-muted">${o.lastDrawsAgo}x lalu</span>
    </div>`
  ).join('');
}

function renderFreqBars(elId, items, color, total) {
  const max = items[0]?.frequency ?? 1;
  const el = document.getElementById(elId);
  el.innerHTML = items.map(item => `
    <div class="chart-bar-row">
      <div class="chart-bar-label">${item.number}</div>
      <div class="chart-bar-outer">
        <div class="chart-bar-inner" style="width:${(item.frequency/max*100).toFixed(1)}%; background:${color};"></div>
      </div>
      <div class="chart-bar-val">${item.frequency}x</div>
    </div>
  `).join('');
}

// ─── Quick predict ───────────────────────────────────────────────────────────

async function refreshQuickPredict() {
  const el = document.getElementById('quick-predict-balls');
  el.innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await api('/predict?mode=balanced');
    renderBalls(data.predictions, data.extra, el, '');
  } catch (e) {
    el.innerHTML = `<span class="text-muted text-sm">${e.message}</span>`;
  }
}

// ─── Prediction page ─────────────────────────────────────────────────────────

function setMode(btn, mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadPrediction();
}

async function loadPrediction() {
  const ballsEl = document.getElementById('predict-balls');
  const extraEl = document.getElementById('predict-extra-row');
  ballsEl.innerHTML = '<div class="loading-spinner"></div>';
  extraEl.innerHTML = '';
  document.getElementById('explain-list').innerHTML = '<div class="loading-spinner"></div>';
  try {
    const data = await api(`/predict?mode=${currentMode}`);
    renderBalls(data.predictions, data.extra, ballsEl, '');
    if (data.extra) {
      extraEl.innerHTML = `<span class="text-xs text-muted">Extra/Bonus: </span>${renderBall(data.extra, 'ball-sm', true)}`;
    }
    const fill = document.getElementById('confidence-fill');
    const val = document.getElementById('confidence-val');
    fill.style.width = '0%';
    setTimeout(() => { fill.style.width = data.confidence + '%'; }, 50);
    val.textContent = data.confidence;
    document.getElementById('draws-analyzed').textContent = data.totalDrawsAnalyzed;

    renderExplanations(data.explanations);
    renderHistChart();
  } catch (e) {
    ballsEl.innerHTML = `<span class="text-muted text-sm">${e.message}</span>`;
    toast(e.message, 'error');
  }
}

function renderExplanations(items) {
  const el = document.getElementById('explain-list');
  el.innerHTML = items.map(item => {
    const cls = item.reason === 'Hot streak' ? 'hot' : item.reason === 'Overdue' ? 'overdue' :
                item.reason === 'High frequency' ? 'freq' : 'stat';
    return `
      <div class="explain-item ${cls}">
        ${renderBall(item.number, 'ball-sm')}
        <div class="explain-meta">
          <div>Frekuensi: <strong>${item.frequency}x</strong> (${item.pct}%) &nbsp;·&nbsp; Terakhir: <strong>${item.lastDrawsAgo}x draw lalu</strong></div>
          <div>Skor bobot: <strong>${item.score}</strong></div>
        </div>
        <span class="explain-reason">${item.reason}</span>
      </div>
    `;
  }).join('');
}

async function renderHistChart() {
  try {
    const data = await api('/history-chart');
    const el = document.getElementById('hist-chart');
    const maxSum = Math.max(...data.data.map(d => d.sum), 1);
    el.innerHTML = data.data.slice(-10).map(d => `
      <div class="chart-bar-row" style="margin-bottom:4px;">
        <div style="font-size:10px;color:var(--text-muted);width:60px;flex-shrink:0;">${d.date?.slice(5) ?? ''}</div>
        <div class="chart-bar-outer">
          <div class="chart-bar-inner" style="width:${(d.sum/maxSum*100).toFixed(1)}%; background:linear-gradient(90deg,#3b82f6,#8b5cf6);"></div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);width:30px;text-align:right;">Σ${d.sum}</div>
      </div>
    `).join('');
  } catch (_) {}
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

async function loadHeatmap() {
  if (!statsCache) {
    const data = await api('/stats');
    statsCache = data;
  }
  renderHeatmap(statsCache);
}

function renderHeatmap(data) {
  const grid = document.getElementById('num-grid');
  if (!grid) return;
  const maxFreq = Math.max(...data.numbers.map(n => n.frequency), 1);
  const predicted = [];

  grid.innerHTML = data.numbers.map(n => {
    const ratio = n.frequency / maxFreq;
    const heat = ratio >= 0.8 ? 5 : ratio >= 0.6 ? 4 : ratio >= 0.4 ? 3 : ratio >= 0.2 ? 2 : ratio > 0.05 ? 1 : 0;
    return `
      <div class="num-cell heat-${heat}" data-num="${n.number}" title="Angka ${n.number}: ${n.frequency}x (${n.pct}%), ${n.lastDrawsAgo} draw lalu">
        <div class="num">${n.number}</div>
        <div class="freq">${n.frequency}x</div>
      </div>
    `;
  }).join('');

  const freqDist = document.getElementById('freq-dist');
  const maxF = Math.max(...data.numbers.map(n => n.frequency), 1);
  freqDist.innerHTML = data.numbers.map(n => `
    <div class="chart-bar-row">
      <div class="chart-bar-label">${n.number}</div>
      <div class="chart-bar-outer">
        <div class="chart-bar-inner" style="width:${(n.frequency/maxF*100).toFixed(1)}%;background:${n.isHot?'#ef4444':n.isCold?'#3b82f6':'#10b981'};"></div>
      </div>
      <div class="chart-bar-val">${n.frequency}x</div>
    </div>
  `).join('');

  const tbl = document.getElementById('freq-table');
  const sorted = [...data.numbers].sort((a, b) => b.frequency - a.frequency);
  tbl.innerHTML = sorted.map(n => `
    <tr>
      <td><strong>${n.number}</strong></td>
      <td>${n.frequency}</td>
      <td>${n.pct}%</td>
      <td>${n.isHot ? '<span class="tag tag-hot">Hot</span>' : n.isCold ? '<span class="tag tag-cold">Cold</span>' : '—'}</td>
      <td class="${n.lastDrawsAgo > 10 ? 'text-accent' : 'text-muted'}">${n.lastDrawsAgo} draw lalu</td>
    </tr>
  `).join('');
}

// ─── History ──────────────────────────────────────────────────────────────────

async function loadHistory() {
  const tbody = document.getElementById('history-table');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;"><div class="loading-spinner" style="margin:1rem auto;"></div></td></tr>';
  try {
    const data = await api(`/results?limit=${PAGE_SIZE}&offset=${historyPage * PAGE_SIZE}`);
    historyTotal = data.total;
    document.getElementById('history-count').textContent = `${data.total} hasil`;
    document.getElementById('pager-info').textContent = `${historyPage * PAGE_SIZE + 1}–${Math.min((historyPage+1)*PAGE_SIZE, data.total)} dari ${data.total}`;
    document.getElementById('pager-prev').disabled = historyPage === 0;
    document.getElementById('pager-next').disabled = (historyPage + 1) * PAGE_SIZE >= data.total;

    tbody.innerHTML = data.data.map((r, i) => {
      const nums = [r.n1, r.n2, r.n3, r.n4, r.n5, r.n6];
      return `
        <tr>
          <td class="text-muted">${data.total - (historyPage * PAGE_SIZE + i)}</td>
          <td>${r.period ?? '—'}</td>
          <td>${r.draw_date}</td>
          <td><div class="balls-row">${nums.map(n => renderBall(n, 'ball-sm')).join('')}</div></td>
          <td>${r.extra ? renderBall(r.extra, 'ball-sm', true) : '—'}</td>
          <td><span class="tag ${r.source === 'manual' ? 'tag-overdue' : 'tag-cold'}">${r.source}</span></td>
          <td>${r.source === 'manual' ? `<button class="btn btn-danger" onclick="deleteResult(${r.id}, this)">🗑</button>` : ''}</td>
        </tr>
      `;
    }).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-muted" style="text-align:center;">${e.message}</td></tr>`;
    toast(e.message, 'error');
  }
}

function changePage(dir) {
  const newPage = historyPage + dir;
  if (newPage < 0 || newPage * PAGE_SIZE >= historyTotal) return;
  historyPage = newPage;
  loadHistory();
}

async function deleteResult(id, btn) {
  if (!confirm('Hapus result ini?')) return;
  try {
    await api(`/results/${id}`, { method: 'DELETE' });
    toast('Result dihapus');
    loadHistory();
    loadStats();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── Form ─────────────────────────────────────────────────────────────────────

async function submitResult(e) {
  e.preventDefault();
  const nums = ['n1','n2','n3','n4','n5','n6'].map(id => parseInt(document.getElementById('f-' + id).value));
  const uniqueNums = new Set(nums);
  if (uniqueNums.size < 6) { toast('6 angka harus unik!', 'error'); return; }
  if (nums.some(n => n < 1 || n > 49)) { toast('Semua angka harus antara 1–49', 'error'); return; }

  const body = {
    draw_date: document.getElementById('f-date').value,
    period: document.getElementById('f-period').value || undefined,
    n1: nums[0], n2: nums[1], n3: nums[2], n4: nums[3], n5: nums[4], n6: nums[5],
    extra: document.getElementById('f-extra').value ? parseInt(document.getElementById('f-extra').value) : undefined,
  };

  try {
    await api('/results', { method: 'POST', body: JSON.stringify(body) });
    toast('Result berhasil disimpan! 🎉');
    document.getElementById('add-form').reset();
    statsCache = null;
    loadStats();
    refreshQuickPredict();
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.getElementById('f-date').value = new Date().toISOString().split('T')[0];

(async function init() {
  await loadStats();
  refreshQuickPredict();
})();
