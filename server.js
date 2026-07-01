const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Numerical Differentiation API ───────────────────────────────────────────

/**
 * Safely evaluate a math function string
 */
function safeEval(funcStr, x) {
  try {
    const fn = new Function('x', `
      const sin = Math.sin, cos = Math.cos, tan = Math.tan,
            log = Math.log, ln = Math.log, log10 = Math.log10,
            exp = Math.exp, sqrt = Math.sqrt, abs = Math.abs,
            PI = Math.PI, E = Math.E, pow = Math.pow,
            asin = Math.asin, acos = Math.acos, atan = Math.atan,
            sinh = Math.sinh, cosh = Math.cosh, tanh = Math.tanh,
            ceil = Math.ceil, floor = Math.floor, round = Math.round;
      return ${funcStr};
    `);
    const result = fn(x);
    if (!isFinite(result) || isNaN(result)) return null;
    return result;
  } catch (e) {
    return null;
  }
}

/**
 * Forward Difference: f'(x) ≈ [f(x+h) - f(x)] / h
 * Higher order: f''(x) ≈ [f(x+2h) - 2f(x+h) + f(x)] / h²
 */
function forwardDiff(fn, x, h, order) {
  if (order === 1) {
    const fx   = safeEval(fn, x);
    const fxh  = safeEval(fn, x + h);
    if (fx === null || fxh === null) return null;
    return (fxh - fx) / h;
  } else if (order === 2) {
    const fx   = safeEval(fn, x);
    const fxh  = safeEval(fn, x + h);
    const fx2h = safeEval(fn, x + 2 * h);
    if (fx === null || fxh === null || fx2h === null) return null;
    return (fx2h - 2 * fxh + fx) / (h * h);
  } else if (order === 3) {
    const fx   = safeEval(fn, x);
    const fxh  = safeEval(fn, x + h);
    const fx2h = safeEval(fn, x + 2 * h);
    const fx3h = safeEval(fn, x + 3 * h);
    if (fx === null || fxh === null || fx2h === null || fx3h === null) return null;
    return (fx3h - 3 * fx2h + 3 * fxh - fx) / (h * h * h);
  }
  return null;
}

/**
 * Backward Difference: f'(x) ≈ [f(x) - f(x-h)] / h
 */
function backwardDiff(fn, x, h, order) {
  if (order === 1) {
    const fx  = safeEval(fn, x);
    const fxh = safeEval(fn, x - h);
    if (fx === null || fxh === null) return null;
    return (fx - fxh) / h;
  } else if (order === 2) {
    const fx   = safeEval(fn, x);
    const fxh  = safeEval(fn, x - h);
    const fx2h = safeEval(fn, x - 2 * h);
    if (fx === null || fxh === null || fx2h === null) return null;
    return (fx - 2 * fxh + fx2h) / (h * h);
  } else if (order === 3) {
    const fx   = safeEval(fn, x);
    const fxh  = safeEval(fn, x - h);
    const fx2h = safeEval(fn, x - 2 * h);
    const fx3h = safeEval(fn, x - 3 * h);
    if (fx === null || fxh === null || fx2h === null || fx3h === null) return null;
    return (fx - 3 * fxh + 3 * fx2h - fx3h) / (h * h * h);
  }
  return null;
}

/**
 * Central Difference: f'(x) ≈ [f(x+h) - f(x-h)] / 2h
 */
function centralDiff(fn, x, h, order) {
  if (order === 1) {
    const fxph = safeEval(fn, x + h);
    const fxmh = safeEval(fn, x - h);
    if (fxph === null || fxmh === null) return null;
    return (fxph - fxmh) / (2 * h);
  } else if (order === 2) {
    const fxph = safeEval(fn, x + h);
    const fx   = safeEval(fn, x);
    const fxmh = safeEval(fn, x - h);
    if (fxph === null || fx === null || fxmh === null) return null;
    return (fxph - 2 * fx + fxmh) / (h * h);
  } else if (order === 3) {
    const fxp2h = safeEval(fn, x + 2 * h);
    const fxph  = safeEval(fn, x + h);
    const fxmh  = safeEval(fn, x - h);
    const fxm2h = safeEval(fn, x - 2 * h);
    if (fxp2h === null || fxph === null || fxmh === null || fxm2h === null) return null;
    return (fxp2h - 2 * fxph + 2 * fxmh - fxm2h) / (2 * h * h * h);
  }
  return null;
}

/**
 * Generate table data around x for a given method
 */
function generateTable(fn, x, h, method, order, steps = 5) {
  const rows = [];
  const start = x - steps * h;
  for (let i = 0; i <= steps * 2; i++) {
    const xi = parseFloat((start + i * h).toPrecision(10));
    const fxi = safeEval(fn, xi);
    let deriv = null;
    if (method === 'forward')  deriv = forwardDiff(fn, xi, h, order);
    if (method === 'backward') deriv = backwardDiff(fn, xi, h, order);
    if (method === 'central')  deriv = centralDiff(fn, xi, h, order);
    rows.push({ x: xi, fx: fxi, derivative: deriv });
  }
  return rows;
}

/**
 * Generate chart data: original function + derivative curves
 */
function generateChartData(fn, x, h, rangeMin, rangeMax, order = 1, points = 200) {
  const step = (rangeMax - rangeMin) / points;
  const funcData = [], forwardData = [], backwardData = [], centralData = [];

  for (let i = 0; i <= points; i++) {
    const xi = parseFloat((rangeMin + i * step).toPrecision(10));
    const fxi = safeEval(fn, xi);
    funcData.push({ x: xi, y: fxi });

    // FIX: gunakan order yang dipilih user, bukan hardcode 1
    const fw = forwardDiff(fn, xi, h, order);
    const bw = backwardDiff(fn, xi, h, order);
    const cd = centralDiff(fn, xi, h, order);
    forwardData.push({ x: xi, y: fw });
    backwardData.push({ x: xi, y: bw });
    centralData.push({ x: xi, y: cd });
  }

  return { funcData, forwardData, backwardData, centralData };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.post('/api/calculate', (req, res) => {
  const { func, x, h, method, order, rangeMin, rangeMax } = req.body;

  if (!func || x === undefined || !h || !method || !order) {
    return res.status(400).json({ error: 'Parameter tidak lengkap.' });
  }

  const xNum     = parseFloat(x);
  const hNum     = parseFloat(h);
  const orderNum = parseInt(order);
  const rMin     = parseFloat(rangeMin ?? xNum - 2);
  const rMax     = parseFloat(rangeMax ?? xNum + 2);

  // Validate function
  const testVal = safeEval(func, xNum);
  if (testVal === null) {
    return res.status(400).json({ error: 'Fungsi tidak valid atau tidak terdefinisi di titik tersebut.' });
  }

  let result = null;
  if (method === 'forward')  result = forwardDiff(func, xNum, hNum, orderNum);
  if (method === 'backward') result = backwardDiff(func, xNum, hNum, orderNum);
  if (method === 'central')  result = centralDiff(func, xNum, hNum, orderNum);

  // All three methods for comparison
  const comparison = {
    forward:  forwardDiff(func, xNum, hNum, orderNum),
    backward: backwardDiff(func, xNum, hNum, orderNum),
    central:  centralDiff(func, xNum, hNum, orderNum),
  };

  // Error analysis (relative error between methods)
  const trueVal = comparison.central; // use central as "most accurate" reference
  // FIX: jika trueVal = 0, hindari pembagian nol — gunakan absolute error saja
  const errorForward  = trueVal !== null && comparison.forward  !== null
    ? (trueVal !== 0
        ? Math.abs((comparison.forward  - trueVal) / trueVal) * 100
        : Math.abs(comparison.forward  - trueVal) * 100)
    : null;
  const errorBackward = trueVal !== null && comparison.backward !== null
    ? (trueVal !== 0
        ? Math.abs((comparison.backward - trueVal) / trueVal) * 100
        : Math.abs(comparison.backward - trueVal) * 100)
    : null;

  // Table
  const table = generateTable(func, xNum, hNum, method, orderNum);

  // Chart — FIX: teruskan orderNum agar grafik sesuai orde yang dipilih
  const chart = generateChartData(func, xNum, hNum, rMin, rMax, orderNum);

  // Formulas
  const formulas = {
    forward: {
      1: 'f\'(x) ≈ [f(x+h) - f(x)] / h',
      2: 'f\'\'(x) ≈ [f(x+2h) - 2f(x+h) + f(x)] / h²',
      3: 'f\'\'\'(x) ≈ [f(x+3h) - 3f(x+2h) + 3f(x+h) - f(x)] / h³',
    },
    backward: {
      1: 'f\'(x) ≈ [f(x) - f(x-h)] / h',
      2: 'f\'\'(x) ≈ [f(x) - 2f(x-h) + f(x-2h)] / h²',
      3: 'f\'\'\'(x) ≈ [f(x) - 3f(x-h) + 3f(x-2h) - f(x-3h)] / h³',
    },
    central: {
      1: 'f\'(x) ≈ [f(x+h) - f(x-h)] / 2h',
      2: 'f\'\'(x) ≈ [f(x+h) - 2f(x) + f(x-h)] / h²',
      3: 'f\'\'\'(x) ≈ [f(x+2h) - 2f(x+h) + 2f(x-h) - f(x-2h)] / 2h³',
    },
  };

  res.json({
    result,
    comparison,
    error: { forward: errorForward, backward: errorBackward },
    table,
    chart,
    formula: formulas[method][orderNum],
    fx: testVal,
    x: xNum,
    h: hNum,
    method,
    order: orderNum,
  });
});

// Convergence test: vary h and observe derivative
app.post('/api/convergence', (req, res) => {
  const { func, x, method, order } = req.body;
  const xNum = parseFloat(x);
  const orderNum = parseInt(order);

  const hValues = [0.5, 0.2, 0.1, 0.05, 0.01, 0.005, 0.001, 0.0005, 0.0001];
  const data = hValues.map(h => {
    let val = null;
    if (method === 'forward')  val = forwardDiff(func, xNum, h, orderNum);
    if (method === 'backward') val = backwardDiff(func, xNum, h, orderNum);
    if (method === 'central')  val = centralDiff(func, xNum, h, orderNum);
    return { h, value: val };
  });

  res.json({ convergence: data });
});

app.listen(PORT, () => {
  console.log(`🚀 CalDiff Server running at http://localhost:${PORT}`);
});
