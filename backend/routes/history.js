const express = require('express');
const axios = require('axios');
const router = express.Router();

const BINANCE_SPOT = 'https://api.binance.com';

// GET /api/candles?symbol=BTCUSDT&interval=1h&limit=500
router.get('/candles', async (req, res) => {
  const { symbol = 'BTCUSDT', interval = '1h', limit = 500 } = req.query;
  try {
    const response = await axios.get(`${BINANCE_SPOT}/api/v3/klines`, {
      params: { symbol, interval, limit: Math.min(Number(limit), 1000) },
      timeout: 15000,
    });

    // Transform Binance klines format into friendly objects
    const candles = response.data.map((k) => ({
      time: Math.floor(k[0] / 1000), // unix seconds
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
    console.error('candles error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/klines' });
  }
});

module.exports = router;
