const BINANCE = 'https://api.binance.com';

async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCandles(symbol, interval, limit = 500) {
  const data = await get(`${BINANCE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return data.map(k => ({
    time: Math.floor(k[0] / 1000),
    open:   parseFloat(k[1]),
    high:   parseFloat(k[2]),
    low:    parseFloat(k[3]),
    close:  parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function fetchTicker(symbol) {
  const d = await get(`${BINANCE}/api/v3/ticker/24hr?symbol=${symbol}`);
  return {
    price:  parseFloat(d.lastPrice),
    change: parseFloat(d.priceChangePercent),
    high:   parseFloat(d.highPrice),
    low:    parseFloat(d.lowPrice),
  };
}
