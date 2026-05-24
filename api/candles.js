const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol = 'BTCUSDT', interval = '1h', limit = 500 } = req.query;
  try {
    const response = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval, limit: Math.min(Number(limit), 1000) },
      timeout: 15000,
    });
    const candles = response.data.map((k) => ({
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
    res.json(candles);
  } catch (err) {
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/klines' });
  }
};
