/**
 * Utilità statistiche: intervalli di confidenza e formattazione
 */

/**
 * Intervallo di Wilson al 95%
 * @param {number} successes - Numero di successi
 * @param {number} total - Numero totale di osservazioni
 * @returns {{ low: number, high: number, margin: number, center: number }}
 */
export function wilsonCI(successes, total) {
  if (total === 0) return { low: 0, high: 0, margin: 0, center: 0 };
  const z = 1.96;
  const p = successes / total;
  const center = (p + (z * z) / (2 * total)) / (1 + (z * z) / total);
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) /
    (1 + (z * z) / total);
  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    margin,
    center,
  };
}

/**
 * Formatta una percentuale con intervallo di confidenza Wilson
 * es. "63.6% ±7.2% (N=45)"
 * @param {number} successes
 * @param {number} total
 * @returns {string}
 */
export function fmtPct(successes, total) {
  if (total < 5) return `N/D (N=${total})`;
  const ci = wilsonCI(successes, total);
  const pct = ((successes / total) * 100).toFixed(1);
  const marginPct = (ci.margin * 100).toFixed(1);
  return `${pct}% ±${marginPct}%`;
}

/**
 * Restituisce un avviso se il campione è troppo piccolo
 * @param {number} n
 * @returns {string|null}
 */
export function sampleWarning(n) {
  if (n < 5) return 'campione insufficiente';
  if (n < 20) return 'campione piccolo, non concludere nulla';
  return null;
}
