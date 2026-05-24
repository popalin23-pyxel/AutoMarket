/**
 * Servizio API per comunicare con il backend proxy
 */

const BASE_URL = 'http://localhost:3001/api';

/**
 * Funzione generica per fetch con gestione errori
 */
async function apiFetch(endpoint, params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${BASE_URL}${endpoint}?${query}` : `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.warn(`API error ${endpoint}:`, err);
      return null;
    }
    const data = await response.json();
    if (data && data.error) {
      console.warn(`Backend error ${endpoint}:`, data.error);
      return null;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.warn(`Timeout per ${endpoint}`);
    } else {
      console.warn(`Errore fetch ${endpoint}:`, err.message);
    }
    return null;
  }
}

/**
 * Scarica le candele OHLCV
 * @param {string} symbol - Es. BTCUSDT
 * @param {string} interval - Es. 1h
 * @param {number} limit - Numero candele (max 1000)
 * @returns {Array|null}
 */
export async function fetchCandles(symbol = 'BTCUSDT', interval = '1h', limit = 500) {
  return apiFetch('/candles', { symbol, interval, limit });
}

/**
 * Scarica i dati ticker 24h
 * @param {string} symbol
 * @returns {Object|null}
 */
export async function fetchTicker(symbol = 'BTCUSDT') {
  return apiFetch('/ticker', { symbol });
}

/**
 * Scarica il book degli ordini
 * @param {string} symbol
 * @returns {Object|null}
 */
export async function fetchBook(symbol = 'BTCUSDT') {
  return apiFetch('/book', { symbol });
}

/**
 * Scarica il tasso di funding
 * @param {string} symbol
 * @returns {Object|null}
 */
export async function fetchFunding(symbol = 'BTCUSDT') {
  return apiFetch('/funding', { symbol });
}

/**
 * Scarica l'open interest corrente
 * @param {string} symbol
 * @returns {Object|null}
 */
export async function fetchOpenInterest(symbol = 'BTCUSDT') {
  return apiFetch('/openinterest', { symbol });
}

/**
 * Scarica la storia dell'open interest
 * @param {string} symbol
 * @returns {Array|null}
 */
export async function fetchOIHistory(symbol = 'BTCUSDT') {
  return apiFetch('/oi-history', { symbol, period: '1h', limit: 10 });
}

/**
 * Scarica i dati globali del mercato crypto (CoinGecko)
 * @returns {Object|null}
 */
export async function fetchGlobal() {
  return apiFetch('/global');
}
