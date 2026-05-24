const BINANCE_SPOT = 'https://api.binance.com';
const BINANCE_FUTURES = 'https://fapi.binance.com';
const COINGECKO = 'https://api.coingecko.com';

async function externalFetch(url, params = {}) {
  try {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    const response = await fetch(fullUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.code && data.code < 0) {
      console.warn('Binance error:', data.msg);
      return null;
    }
    return data;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.warn(`Timeout per ${url}`);
    } else {
      console.warn(`Errore fetch ${url}:`, err.message);
    }
    return null;
  }
}

export async function fetchCandles(symbol = 'BTCUSDT', interval = '1h', limit = 500) {
  const data = await externalFetch(`${BINANCE_SPOT}/api/v3/klines`, {
    symbol,
    interval,
    limit: Math.min(Number(limit), 1000),
  });
  if (!data) return null;
  return data.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: Math.floor(k[6] / 1000),
    quoteVolume: parseFloat(k[7]),
    trades: parseInt(k[8]),
    takerBuyBaseVolume: parseFloat(k[9]),
    takerBuyQuoteVolume: parseFloat(k[10]),
  }));
}

export async function fetchTicker(symbol = 'BTCUSDT') {
  return externalFetch(`${BINANCE_SPOT}/api/v3/ticker/24hr`, { symbol });
}

export async function fetchBook(symbol = 'BTCUSDT') {
  return externalFetch(`${BINANCE_SPOT}/api/v3/depth`, { symbol, limit: 20 });
}

export async function fetchFunding(symbol = 'BTCUSDT') {
  return externalFetch(`${BINANCE_FUTURES}/fapi/v1/premiumIndex`, { symbol });
}

export async function fetchOpenInterest(symbol = 'BTCUSDT') {
  return externalFetch(`${BINANCE_FUTURES}/fapi/v1/openInterest`, { symbol });
}

export async function fetchOIHistory(symbol = 'BTCUSDT') {
  return externalFetch(`${BINANCE_FUTURES}/futures/data/openInterestHist`, {
    symbol,
    period: '1h',
    limit: 10,
  });
}

export async function fetchGlobal() {
  return externalFetch(`${COINGECKO}/api/v3/global`);
}
