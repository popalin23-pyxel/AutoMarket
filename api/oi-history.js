const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol = 'BTCUSDT', period = '1h', limit = 10 } = req.query;
  try {
    const response = await axios.get('https://fapi.binance.com/futures/data/openInterestHist', {
      params: { symbol, period, limit },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/oi-history' });
  }
};
