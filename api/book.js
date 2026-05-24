const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { symbol = 'BTCUSDT' } = req.query;
  try {
    const response = await axios.get('https://api.binance.com/api/v3/depth', {
      params: { symbol, limit: 20 },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/depth' });
  }
};
