/* ═══════════════════════════════════════════════════════════════
   CalDiff — Main Frontend Logic
   Handles: API calls, Chart rendering, Tab switching, State
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
let state = {
  method: 'forward',
  order:  1,
  lastResult: null,
  panelOpen: false,
};

let charts = {
  main:    null,
  compare: null,
  conv:    null,
};

// ── Formula map (ASCII friendly) ───────────────────────────────
const FORMULAS = {
  forward: {
    1: "f'(x)  ≈  [ f(x+h) − f(x) ] / h",
    2: "f''(x) ≈  [ f(x+2h) − 2f(x+h) + f(x) ] / h²",
    3: "f'''(x) ≈ [ f(x+3h) − 3f(x+2h) + 3f(x+h) − f(x) ] / h³",
  },
  backward: {
    1: "f'(x)  ≈  [ f(x) − f(x−h) ] / h",
    2: "f''(x) ≈  [ f(x) − 2f(x−h) + f(x−2h) ] / h²",
    3: "f'''(x) ≈ [ f(x) − 3f(x−h) + 3f(x−2h) − f(x−3h) ] / h³",
  },
  central: {
    1: "f'(x)  ≈  [ f(x+h) − f(x−h) ] / 2h",
    2: "f''(x) ≈  [ f(x+h) − 2f(x) + f(x−h) ] / h²",
    3: "f'''(x) ≈ [ f(x+2h) − 2f(x+h) + 2f(x−h) − f(x−2h) ] / 2h³",
  },
};

// ── Helpers ────────────────────────────────────────────────────
function fmt(v, decimals = 8) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return parseFloat(v.toFixed(decimals)).toString();
}
function fmtPct(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return v.toFixed(6) + ' %';
}
function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('errorMsg').style.display = 'none';
}

// ── Mobile Panel Drawer ────────────────────────────────────────
function toggleMobilePanel() {
  state.panelOpen ? closeMobilePanel() : openMobilePanel();
}
function openMobilePanel() {
  state.panelOpen = true;
  document.querySelector('.left-panel').classList.add('open');
  document.getElementById('panelOverlay').classList.add('visible');
  const fab = document.getElementById('mobileFab');
  if (fab) fab.textContent = '✕';
}
function closeMobilePanel() {
  state.panelOpen = false;
  document.querySelector('.left-panel').classList.remove('open');
  document.getElementById('panelOverlay').classList.remove('visible');
  const fab = document.getElementById('mobileFab');
  if (fab) fab.textContent = '⚙';
}

// ── Method / Order selection ───────────────────────────────────
function selectMethod(method) {
  state.method = method;
  document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
  document.getElementById('m' + method.charAt(0).toUpperCase() + method.slice(1)).classList.add('active');

  const badge = document.getElementById('activeMethodBadge');
  badge.textContent = method.toUpperCase();
  badge.className = 'method-badge badge-' + method;
}

function selectOrder(order) {
  state.order = order;
  document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('order' + order).classList.add('active');
  document.getElementById('activeOrderBadge').textContent = 'Orde ' + order;
}

// ── Tab switching ──────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.getElementById('panel-' + name).classList.add('active');
}

// ── Shortcut insert ────────────────────────────────────────────
function insertFunc(val) {
  document.getElementById('funcInput').value = val;
}

// ── Chart factory ──────────────────────────────────────────────
function getChartColors() {
  return {
    func:     { line: '#4f6ef7', bg: 'rgba(79,110,247,0.07)'  },
    forward:  { line: '#e07b1a', bg: 'rgba(224,123,26,0.07)'  },
    backward: { line: '#dc3545', bg: 'rgba(220,53,69,0.07)'   },
    central:  { line: '#0da271', bg: 'rgba(13,162,113,0.07)'  },
  };
}

function buildMainChart(chartData, x) {
  const ctx = document.getElementById('mainChart').getContext('2d');
  const col = getChartColors();

  if (charts.main) charts.main.destroy();

  const makeDataset = (label, data, color, dashed = false) => ({
    label,
    data,
    borderColor: color,
    backgroundColor: 'transparent',
    borderWidth: dashed ? 1.5 : 2,
    borderDash: dashed ? [5, 4] : [],
    pointRadius: 0,
    tension: 0.35,
    fill: false,
  });

  charts.main = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        makeDataset('f(x) — Fungsi Asli',           chartData.funcData,     col.func.line),
        makeDataset('f\'(x) Forward Difference',    chartData.forwardData,  col.forward.line,  true),
        makeDataset('f\'(x) Backward Difference',   chartData.backwardData, col.backward.line, true),
        makeDataset('f\'(x) Central Difference',    chartData.centralData,  col.central.line),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#161f30',
          borderColor: 'rgba(99,130,190,0.28)',
          borderWidth: 1,
          titleColor: '#9aafc8',
          bodyColor: '#e8edf5',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(6) : 'N/A'}`,
          },
        },
        annotation: {
          annotations: {
            xLine: {
              type: 'line',
              xMin: x, xMax: x,
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 1,
              borderDash: [4, 4],
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          grid: { color: 'rgba(60,80,160,0.07)' },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'x', color: '#8a96b8', font: { size: 11 } },
        },
        y: {
          grid: { color: 'rgba(60,80,160,0.07)' },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'y', color: '#8a96b8', font: { size: 11 } },
        },
      },
    },
  });

  // Legend
  const col2 = getChartColors();
  const legendEl = document.getElementById('chartLegend');
  legendEl.innerHTML = [
    ['f(x) Fungsi Asli',        col2.func.line],
    ['Forward Difference',       col2.forward.line],
    ['Backward Difference',      col2.backward.line],
    ['Central Difference',       col2.central.line],
  ].map(([label, color]) =>
    `<div class="legend-item">
       <div class="legend-dot" style="background:${color}"></div>
       <span>${label}</span>
     </div>`
  ).join('');
}

function buildCompareChart(comparison, x) {
  const ctx = document.getElementById('compareChart').getContext('2d');
  if (charts.compare) charts.compare.destroy();

  const labels = ['Forward Difference', 'Backward Difference', 'Central Difference'];
  const values = [comparison.forward, comparison.backward, comparison.central];
  const colors = ['rgba(245,166,35,0.8)', 'rgba(224,90,90,0.8)', 'rgba(61,219,168,0.8)'];
  const borders = ['#f5a623', '#e05a5a', '#3ddba8'];

  charts.compare = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `f'(${x})`,
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 2,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(60,80,160,0.2)',
          borderWidth: 1,
          titleColor: '#4a5680',
          bodyColor: '#1a2340',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(6) : 'N/A'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
        },
        y: {
          grid: { color: 'rgba(60,80,160,0.07)' },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
        },
      },
    },
  });
}

function buildConvChart(convData) {
  const ctx = document.getElementById('convChart').getContext('2d');
  if (charts.conv) charts.conv.destroy();

  const labels = convData.map(d => d.h.toString());
  const values = convData.map(d => d.value);

  charts.conv = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nilai Aproksimasi',
        data: values,
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.08)',
        borderWidth: 2,
        pointBackgroundColor: '#4f8ef7',
        pointRadius: 5,
        tension: 0.25,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(60,80,160,0.2)',
          borderWidth: 1,
          titleColor: '#4a5680',
          bodyColor: '#1a2340',
          callbacks: {
            title: ctx => `h = ${ctx[0].label}`,
            label: ctx => ` Nilai: ${ctx.parsed.y !== null ? ctx.parsed.y.toFixed(8) : 'N/A'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(60,80,160,0.07)' },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: 'Nilai h (step size)', color: '#8a96b8' },
        },
        y: {
          grid: { color: 'rgba(60,80,160,0.07)' },
          ticks: { color: '#8a96b8', font: { family: 'JetBrains Mono', size: 10 } },
          title: { display: true, text: "f'(x₀) approx", color: '#8a96b8' },
        },
      },
    },
  });
}

// ── Table render ───────────────────────────────────────────────
function renderTable(tableData, targetX, method, order) {
  const tbody = document.getElementById('tableBody');
  const info  = document.getElementById('tableInfo');

  info.textContent =
    `Metode: ${method.toUpperCase()} | Orde: ${order} | ${tableData.length} baris | Titik target x₀ disorot`;

  let prevDeriv = null;
  tbody.innerHTML = tableData.map((row, i) => {
    const isTarget = Math.abs(row.x - targetX) < 1e-9;
    const delta = prevDeriv !== null && row.derivative !== null
      ? (row.derivative - prevDeriv).toFixed(8)
      : '—';
    prevDeriv = row.derivative;
    return `<tr class="${isTarget ? 'row-target' : ''}">
      <td>${i + 1}</td>
      <td>${fmt(row.x, 4)}</td>
      <td>${fmt(row.fx, 8)}</td>
      <td>${fmt(row.derivative, 8)}</td>
      <td>${delta}</td>
    </tr>`;
  }).join('');
}

// ── Compare table render ──────────────────────────────────────
function renderCompareTable(comparison, errors) {
  const tbody = document.getElementById('compareBody');
  const central = comparison.central;

  const rows = [
    { name: 'Forward Difference',  val: comparison.forward,  err: errors.forward,  key: 'forward'  },
    { name: 'Backward Difference', val: comparison.backward, err: errors.backward, key: 'backward' },
    { name: 'Central Difference',  val: central,             err: 0,               key: 'central'  },
  ];

  tbody.innerHTML = rows.map(r => {
    const errStr = r.key === 'central' ? '<span class="accuracy-high">Referensi</span>' : fmtPct(r.err);
    let accuracy = '';
    if (r.key === 'central')                               accuracy = '<span class="accuracy-high">★ Terbaik</span>';
    else if (r.err !== null && r.err < 0.01)              accuracy = '<span class="accuracy-high">Sangat Akurat</span>';
    else if (r.err !== null && r.err < 1)                 accuracy = '<span class="accuracy-mid">Cukup Akurat</span>';
    else                                                   accuracy = '<span class="accuracy-low">Kurang Akurat</span>';

    const colors = { forward: '#f5a623', backward: '#e05a5a', central: '#3ddba8' };
    return `<tr>
      <td><span style="color:${colors[r.key]};font-weight:600">${r.name}</span></td>
      <td class="mono">${fmt(r.val, 8)}</td>
      <td class="mono">${errStr}</td>
      <td>${accuracy}</td>
    </tr>`;
  }).join('');
}

// ── Formula panel render ──────────────────────────────────────
function renderFormulaPanel(data) {
  const { comparison, order } = data;

  document.getElementById('fwdFormula').textContent = FORMULAS.forward[order];
  document.getElementById('bwdFormula').textContent = FORMULAS.backward[order];
  document.getElementById('cdFormula').textContent  = FORMULAS.central[order];

  document.getElementById('fwdResult').textContent = fmt(comparison.forward);
  document.getElementById('bwdResult').textContent = fmt(comparison.backward);
  document.getElementById('cdResult').textContent  = fmt(comparison.central);

  const fn   = document.getElementById('funcInput').value;
  const x    = document.getElementById('xInput').value;
  const h    = document.getElementById('hInput').value;
  const meth = state.method;

  document.getElementById('summaryGrid').innerHTML = `
    <div class="sum-item"><span class="sum-label">Fungsi f(x)</span><span class="sum-val">${fn}</span></div>
    <div class="sum-item"><span class="sum-label">Titik x₀</span><span class="sum-val">${x}</span></div>
    <div class="sum-item"><span class="sum-label">Step h</span><span class="sum-val">${h}</span></div>
    <div class="sum-item"><span class="sum-label">f(x₀)</span><span class="sum-val">${fmt(data.fx)}</span></div>
    <div class="sum-item"><span class="sum-label">Orde Turunan</span><span class="sum-val">${order}</span></div>
    <div class="sum-item"><span class="sum-label">Metode Aktif</span><span class="sum-val" style="color:var(--accent)">${meth.toUpperCase()}</span></div>
    <div class="sum-item"><span class="sum-label">Hasil (${meth})</span><span class="sum-val">${fmt(data.result)}</span></div>
    <div class="sum-item"><span class="sum-label">Error vs Central</span><span class="sum-val">${meth !== 'central' ? fmtPct(data.error[meth]) : 'Referensi'}</span></div>
  `;
}

// ── Stat bar update ────────────────────────────────────────────
function updateStats(data) {
  document.getElementById('statResultVal').textContent  = fmt(data.result);
  document.getElementById('statErrFwdVal').textContent  = fmtPct(data.error.forward);
  document.getElementById('statErrBwdVal').textContent  = fmtPct(data.error.backward);
  document.getElementById('statMethod').textContent     = data.method.toUpperCase();
  document.getElementById('statHVal').textContent       = 'h = ' + data.h;
}

// ── Main calculate ────────────────────────────────────────────
async function calculate() {
  hideError();
  const btn = document.getElementById('calcBtn');
  btn.classList.add('loading', 'pulsing');
  btn.textContent = '⏳ Menghitung...';

  const payload = {
    func:     document.getElementById('funcInput').value.trim(),
    x:        parseFloat(document.getElementById('xInput').value),
    h:        parseFloat(document.getElementById('hInput').value),
    rangeMin: parseFloat(document.getElementById('rangeMinInput').value),
    rangeMax: parseFloat(document.getElementById('rangeMaxInput').value),
    method:   state.method,
    order:    state.order,
  };

  if (!payload.func) {
    showError('Fungsi tidak boleh kosong.');
    resetBtn(); return;
  }
  if (isNaN(payload.x) || isNaN(payload.h)) {
    showError('Titik x₀ dan step h harus berupa angka valid.');
    resetBtn(); return;
  }
  if (payload.h <= 0) {
    showError('Step h harus lebih besar dari 0.');
    resetBtn(); return;
  }

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || 'Terjadi kesalahan server.'); resetBtn(); return; }

    state.lastResult = data;

    // Update all panels
    updateStats(data);
    renderTable(data.table, payload.x, data.method, data.order);
    renderFormulaPanel(data);
    renderCompareTable(data.comparison, data.error);
    buildMainChart(data.chart, payload.x);
    buildCompareChart(data.comparison, payload.x);

    // Convergence (async)
    fetchConvergence(payload);

  } catch (err) {
    showError('Koneksi ke server gagal: ' + err.message);
  }

  // Auto-close panel on mobile after calculation
  if (window.innerWidth <= 768) closeMobilePanel();

  resetBtn();
}

function resetBtn() {
  const btn = document.getElementById('calcBtn');
  btn.classList.remove('loading', 'pulsing');
  btn.innerHTML = '<span class="calc-icon">∂</span> Hitung Turunan';
}

async function fetchConvergence(payload) {
  try {
    const res = await fetch('/api/convergence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        func:   payload.func,
        x:      payload.x,
        method: payload.method,
        order:  payload.order,
      }),
    });
    const data = await res.json();
    if (data.convergence) buildConvChart(data.convergence);
  } catch (_) {}
}

// ── Enter key support ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ['funcInput', 'xInput', 'hInput', 'rangeMinInput', 'rangeMaxInput'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') calculate();
    });
  });

  // Initial state badges
  selectMethod('forward');
  selectOrder(1);
});
