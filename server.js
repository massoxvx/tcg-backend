// server.js - TCG Inventory Tracker Backend
// npm install express cors dotenv node-fetch@2

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// JustTCG API Configuration
const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY;
const BASE_URL = 'https://api.justtcg.com/v1';

// Log presence of the API key (boolean only) - safe for logs
console.log('JUSTTCG_API_KEY present:', !!JUSTTCG_API_KEY);

// Helper: normalize price from common shapes
function normalizePrice(price) {
  if (price == null) return { amount: 0, currency: null };
  if (typeof price === 'number') return { amount: price, currency: null };
  if (typeof price === 'string' && !isNaN(Number(price))) {
    return { amount: Number(price), currency: null };
  }
  if (typeof price === 'object') {
    const amount = price.amount ?? price.value ?? price.price ?? price.lowest ?? price.min ?? null;
    const currency = price.currency ?? price.cur ?? null;
    if (amount != null && !isNaN(Number(amount))) {
      return { amount: Number(amount), currency: currency || null };
    }
    if (price.prices) {
      const p = price.prices.lowest ?? price.prices.min ?? price.prices[0];
      if (p != null && !isNaN(Number(p))) {
        return { amount: Number(p), currency: currency || null };
      }
    }
  }
  return { amount: 0, currency: null };
}

// Middleware/helper to ensure API key is configured before calling JustTCG
function requireJustTcgKey(req, res, next) {
  if (!JUSTTCG_API_KEY) {
    // Return 500 with a helpful message so client sees configuration issue
    return res.status(500).json({ error: 'JustTCG API key not configured on server (JUSTTCG_API_KEY)' });
  }
  next();
}

// ---------- HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend is running' });
});

// ---------- CARD SEARCH ----------
app.get('/api/cards/search', requireJustTcgKey, async (req, res) => {
  try {
    const { game, q, limit = 20 } = req.query;
    if (!game || !q) {
      return res.status(400).json({ error: 'Missing game or q' });
    }

    const url = `${BASE_URL}/cards?q=${encodeURIComponent(q)}&game=${encodeURIComponent(game)}&limit=${limit}`;
    const response = await fetch(url, {
      headers: {
        'X-API-Key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error || 'JustTCG API error' });
    }

    const apiData = await response.json();
    const rawCards = apiData.data || [];

    // CLEAN DATA: Prefer variant.image (more specific) then fallback to card.image
    const cards = rawCards.map(card => {
      const variant = card.variants?.[0] || {};
      const image = variant.image || card.image || null;

      const priceInfo = normalizePrice(variant.price ?? variant.prices ?? card.price ?? card.prices);

      return {
        id: card.id,
        name: card.name,
        set_name: card.set_name || card.set,
        set: card.set,
        number: card.number,
        image: image,
        price: priceInfo.amount,
        currency: priceInfo.currency,
        variant_id: variant.id ?? null
      };
    });

    res.json({ data: cards });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- SINGLE CARD PRICE + IMAGE ----------
app.get('/api/cards/price', requireJustTcgKey, async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const url = `${BASE_URL}/cards/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': JUSTTCG_API_KEY }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error || 'Card not found' });
    }

    const card = await response.json();
    const variant = card.variants?.[0] || {};

    // Prefer variant image first (variant images are usually SKU-specific), then card.image
    const image = variant.image || card.image || null;

    // Normalize price from several possible shapes
    const priceInfo = normalizePrice(variant.price ?? variant.prices ?? card.price ?? card.prices);

    // Return structured data so frontend can pick correct fields
    res.json({
      price: priceInfo.amount,
      currency: priceInfo.currency,
      image: image,
      variant_id: variant.id ?? null,
      // raw debug is optional — remove or set via env in production
      raw: process.env.SHOW_RAW === 'true' ? { card, variant } : undefined
    });
  } catch (err) {
    console.error('Price error:', err);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// ---------- OPTIONAL: LIST GAMES ----------
app.get('/api/games', requireJustTcgKey, async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/games`, {
      headers: { 'X-API-Key': JUSTTCG_API_KEY }
    });
    const data = await response.ok ? await response.json() : { error: 'Failed' };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Server error' });
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`TCG Backend running on port ${PORT}`);
  console.log(`Health → http://localhost:${PORT}/api/health`);
});
