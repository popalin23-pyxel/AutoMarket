const express = require('express');
const axios = require('axios');
const router = express.Router();

const BINANCE_SPOT = 'https://api.binance.com';
const BINANCE_FUTURES = 'https://fapi.binance.com';
const COINGECKO = 'https://api.coingecko.com';

// GET /api/ticker?symbol=BTCUSDT
router.get('/ticker', async (req, res) => {
  const { symbol = 'BTCUSDT' } = req.query;
  try {
    const response = await axios.get(`${BINANCE_SPOT}/api/v3/ticker/24hr`, {
      params: { symbol },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('ticker error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/ticker' });
  }
});

// GET /api/book?symbol=BTCUSDT
router.get('/book', async (req, res) => {
  const { symbol = 'BTCUSDT' } = req.query;
  try {
    const response = await axios.get(`${BINANCE_SPOT}/api/v3/depth`, {
      params: { symbol, limit: 20 },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('book error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/depth' });
  }
});

// GET /api/funding?symbol=BTCUSDT
router.get('/funding', async (req, res) => {
  const { symbol = 'BTCUSDT' } = req.query;
  try {
    const response = await axios.get(`${BINANCE_FUTURES}/fapi/v1/premiumIndex`, {
      params: { symbol },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('funding error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/funding' });
  }
});

// GET /api/openinterest?symbol=BTCUSDT
router.get('/openinterest', async (req, res) => {
  const { symbol = 'BTCUSDT' } = req.query;
  try {
    const response = await axios.get(`${BINANCE_FUTURES}/fapi/v1/openInterest`, {
      params: { symbol },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('openinterest error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/openinterest' });
  }
});

// GET /api/oi-history?symbol=BTCUSDT
router.get('/oi-history', async (req, res) => {
  const { symbol = 'BTCUSDT', period = '1h', limit = 10 } = req.query;
  try {
    const response = await axios.get(`${BINANCE_FUTURES}/futures/data/openInterestHist`, {
      params: { symbol, period, limit },
      timeout: 8000,
    });
    res.json(response.data);
  } catch (err) {
    console.error('oi-history error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'binance/oi-history' });
  }
});

// GET /api/global
router.get('/global', async (req, res) => {
  try {
    const response = await axios.get(`${COINGECKO}/api/v3/global`, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AutoMarket/1.0',
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error('global error:', err.message);
    res.status(502).json({ error: 'dato non disponibile', source: 'coingecko/global' });
  }
});

module.exports = router;
