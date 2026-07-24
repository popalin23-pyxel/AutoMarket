// ─── PRISMA — Sistema di Rilevamento della Prevedibilità del Mercato ───────────
// Tre pilastri: Hurst Exponent, Approximate Entropy, Volume Gravity

// 1. Hurst Exponent via R/S Analysis
// H > 0.55 = trend persistente (memoria positiva)
// H < 0.45 = mean-reverting (memoria negativa)
// H ≈ 0.50 = random walk — mercato imprevedibile
export function calcHurst(closes) {
  if (!closes || closes.length < 64) return 0.5;

  // Log-returns: più stazionari dei prezzi grezzi → R/S analisi corretta
  const lr = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0)
      lr.push(Math.log(closes[i] / closes[i - 1]));
  }

  // Finestre più lunghe = regressione più stabile (minimo 3 punti validi)
  const sizes = [8, 16, 32, 64, 128].filter(s => lr.length >= s * 2);
  if (sizes.length < 3) return 0.5;

  const logRS = [], logN = [];

  for (const n of sizes) {
    const numBlocks = Math.floor(lr.length / n);
    if (numBlocks < 2) continue;

    // Media R/S su più blocchi indipendenti → riduce il rumore
    let sumRS = 0, count = 0;
    for (let b = 0; b < numBlocks; b++) {
      const block = lr.slice(b * n, (b + 1) * n);
      const mean = block.reduce((a, v) => a + v, 0) / n;

      let cumDev = 0, maxDev = -Infinity, minDev = Infinity;
      for (const r of block) {
        cumDev += r - mean;
        if (cumDev > maxDev) maxDev = cumDev;
        if (cumDev < minDev) minDev = cumDev;
      }
      const R = maxDev - minDev;
      const S = Math.sqrt(block.reduce((a, r) => a + (r - mean) ** 2, 0) / n);
      if (S > 0 && R > 0) { sumRS += R / S; count++; }
    }
    if (count > 0) {
      logRS.push(Math.log(sumRS / count));
      logN.push(Math.log(n));
    }
  }

  if (logRS.length < 3) return 0.5;

  // Regressione lineare: H = pendenza di log(R/S) su log(n)
  const m = logRS.length;
  const sumX  = logN.reduce((a, b) => a + b, 0);
  const sumY  = logRS.reduce((a, b) => a + b, 0);
  const sumXY = logN.reduce((s, x, i) => s + x * logRS[i], 0);
  const sumX2 = logN.reduce((s, x) => s + x * x, 0);
  const denom = m * sumX2 - sumX * sumX;
  if (denom === 0) return 0.5;
  return Math.max(0.1, Math.min(0.9, (m * sumXY - sumX * sumY) / denom));
}

// 2. Approximate Entropy
// ApEn bassa = serie regolare = prevedibile
// ApEn alta  = serie caotica = non tradare
export function calcApEn(closes, m = 2, rMultiplier = 0.2) {
  if (!closes || closes.length < m + 2) return 1.0;
  const N = Math.min(closes.length, 50);
  const data = closes.slice(-N);
  const mean = data.reduce((a, b) => a + b, 0) / N;
  const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / N);
  const r = rMultiplier * std;
  if (r === 0) return 0;

  function phi(len) {
    let total = 0, count = 0;
    for (let i = 0; i <= N - len; i++) {
      let matches = 0;
      for (let j = 0; j <= N - len; j++) {
        let ok = true;
        for (let k = 0; k < len; k++) {
          if (Math.abs(data[i + k] - data[j + k]) > r) { ok = false; break; }
        }
        if (ok) matches++;
      }
      if (matches > 0) { total += Math.log(matches / (N - len + 1)); count++; }
    }
    return count > 0 ? total / count : 0;
  }

  return Math.max(0, Math.min(2, phi(m) - phi(m + 1)));
}

// 3. Volume Gravity Field
// Forza gravitazionale del volume: F = V / d²  (legge di Newton applicata ai prezzi)
// Fix: normalizzazione sulla forza totale (non sulla forza massima singola candela)
export function calcVolumeGravity(candles) {
  if (!candles || candles.length < 20) return 0;
  const recent = candles.slice(-50);
  const price = recent[recent.length - 1].close;
  const minDist = price * 0.0005; // distanza minima = 0.05% del prezzo

  let netForce = 0, totalForce = 0;
  for (const c of recent) {
    const mid = (c.high + c.low) / 2;
    const d = Math.max(Math.abs(mid - price), minDist);
    const f = c.volume / (d * d);
    netForce += f * Math.sign(mid - price);
    totalForce += f;
  }

  if (totalForce === 0) return 0;
  return Math.max(-1, Math.min(1, netForce / totalForce));
}

// 4. PRISMA Score (0–100) e stato del mercato
export function calcPrisma(closes, candles) {
  const H      = calcHurst(closes);
  const apEn   = calcApEn(closes);
  const gravity = calcVolumeGravity(candles);

  // Hurst score (0–40): più lontano da 0.5 = più prevedibile
  const hurstScore  = Math.abs(H - 0.5) * 2 * 40;

  // ApEn score (0–40): entropia bassa = alta prevedibilità
  const apEnScore   = Math.max(0, (1.5 - apEn) / 1.5) * 40;

  // Gravity score (0–20): forza netta verso una direzione
  const gravityScore = Math.abs(gravity) * 20;

  const score = Math.min(100, Math.round(hurstScore + apEnScore + gravityScore));

  let state, stateLabel;
  if (score < 35)      { state = 'noise';   stateLabel = 'Stato Rumore'; }
  else if (score < 55) { state = 'range';   stateLabel = 'Stato Range'; }
  else if (score < 72) { state = 'trend';   stateLabel = 'Stato Trend'; }
  else                 { state = 'impulse'; stateLabel = 'Stato Impulso'; }

  // H > 0.55 → trend si continuerà; H < 0.45 → inversione probabile
  const direction = H > 0.55 ? 'continuation' : H < 0.45 ? 'reversal' : 'neutral';

  return { score, state, stateLabel, H, apEn, gravity, direction };
}
