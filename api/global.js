const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/global', {
      timeout: 10000,
      headers: { 'Accept': 'application/json', 'User-Agent': 'AutoMarket/1.0' },
    });
    res.json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'dato non disponibile', source: 'coingecko/global' });
  }
};
