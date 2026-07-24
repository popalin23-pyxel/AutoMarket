// ─── PRISMA — Sistema di Rilevamento della Prevedibilità del Mercato ───────────
// Tre pilastri matematici: Hurst Exponent, Approximate Entropy, Volume Gravity

// 1. Hurst Exponent via R/S Analysis
// Misura la "memoria" del mercato
// H > 0.55 = trend persistente
// H < 0.45 = mean-reverting
// H ~0.5   = random walk, non tradare
export function calcHurst(closes) {
  if (!closes || closes.length < 32) return 0.5;

  const sizes = [8, 16, 32].filter(s => s <= Math.floor(closes.length / 2));
  const logRS = [], logN = [];

  for (const n of sizes) {
    const returns = [];
    for (let i = 1; i < n + 1 && i < closes.length; i++) {
      returns.push(closes[closes.length - n - 1 + i] - closes[closes.length - n - 1 + i - 1]);
    }
    if (returns.length < 4) continue;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    let cumDev = 0, maxDev = -Infinity, minDev = Infinity;
    for (const r of returns) {
      cumDev += r - mean;
      if (cumDev > maxDev) maxDev = cumDev;
      if (cumDev < minDev) minDev = cumDev;
    }
    const R = maxDev - minDev;
    const S = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
    if (S === 0 || R === 0) continue;
    logRS.push(Math.log(R / S));
    logN.push(Math.log(n));
  }

  if (logRS.length < 2) return 0.5;

  // Regressione lineare semplice
  const n = logRS.length;
  const sumX = logN.reduce((a, b) => a + b, 0);
  const sumY = logRS.reduce((a, b) => a + b, 0);
  const sumXY = logN.reduce((s, x, i) => s + x * logRS[i], 0);
  const sumX2 = logN.reduce((s, x) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0.5;
  const H = (n * sumXY - sumX * sumY) / denom;
  return Math.max(0.1, Math.min(0.9, H));
}

// 2. Approximate Entropy
// Misura il "caos" della serie
// ApEn bassa = regolare = prevedibile
// ApEn alta = caotica = non tradare
export function calcApEn(closes, m = 2, rMultiplier = 0.2) {
  if (!closes || closes.length < m + 2) return 1.0;
  const N = Math.min(closes.length, 50); // ultimi 50 valori
  const data = closes.slice(-N);
  const mean = data.reduce((a, b) => a + b, 0) / N;
  const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / N);
  const r = rMultiplier * std;
  if (r === 0) return 0;

  function phi(m) {
    let count = 0, total = 0;
    for (let i = 0; i <= N - m; i++) {
      let matches = 0;
      for (let j = 0; j <= N - m; j++) {
        let match = true;
        for (let k = 0; k < m; k++) {
          if (Math.abs(data[i + k] - data[j + k]) > r) { match = false; break; }
        }
        if (match) matches++;
      }
      if (matches > 0) { count += Math.log(matches / (N - m + 1)); total++; }
    }
    return total > 0 ? count / total : 0;
  }

  const result = phi(m) - phi(m + 1);
  return Math.max(0, Math.min(2, result));
}

// 3. Volume Gravity Field
// Calcola la "forza gravitazionale" del volume sui prezzi
// Positivo = attrazione verso l'alto, Negativo = verso il basso
export function calcVolumeGravity(candles) {
  if (!candles || candles.length < 20) return 0;
  const recent = candles.slice(-50);
  const currentPrice = recent[recent.length - 1].close;

  let force = 0;
  for (const c of recent) {
    const midPrice = (c.high + c.low) / 2;
    const diff = midPrice - currentPrice;
    if (Math.abs(diff) < 0.0001) continue;
    // Newton: F = m / d^2, direzione = segno della differenza
    force += (c.volume / (diff * diff)) * Math.sign(diff);
  }

  // Normalizza tra -1 e +1
  const maxForce = recent.reduce((max, c) => {
    const d = Math.abs((c.high + c.low) / 2 - currentPrice);
    return d > 0.0001 ? Math.max(max, c.volume / (d * d)) : max;
  }, 1);

  return Math.max(-1, Math.min(1, force / maxForce));
}

// 4. PRISMA Score (0-100) e stato del mercato
export function calcPrisma(closes, candles) {
  const H = calcHurst(closes);
  const apEn = calcApEn(closes);
  const gravity = calcVolumeGravity(candles);

  // Hurst score (0-40): più lontano da 0.5 = più prevedibile
  const hurstDist = Math.abs(H - 0.5);
  const hurstScore = hurstDist * 2 * 40; // max 40 quando H=0 o H=1

  // ApEn score (0-40): bassa entropia = alta prevedibilità
  // ApEn tipicamente tra 0 e 1.5 per serie crypto
  const apEnScore = Math.max(0, (1.5 - apEn) / 1.5) * 40;

  // Gravity score (0-20): forza netta verso una direzione
  const gravityScore = Math.abs(gravity) * 20;

  const score = Math.min(100, Math.round(hurstScore + apEnScore + gravityScore));

  let state, stateLabel;
  if (score < 35) { state = 'noise'; stateLabel = 'Stato Rumore'; }
  else if (score < 55) { state = 'range'; stateLabel = 'Stato Range'; }
  else if (score < 72) { state = 'trend'; stateLabel = 'Stato Trend'; }
  else { state = 'impulse'; stateLabel = 'Stato Impulso'; }

  // Direzione preferenziale: H > 0.55 = continua, H < 0.45 = inverte
  const direction = H > 0.55 ? 'continuation' : H < 0.45 ? 'reversal' : 'neutral';

  return { score, state, stateLabel, H, apEn, gravity, direction };
}
