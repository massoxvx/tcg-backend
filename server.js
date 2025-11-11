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

// ---------- HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend is running' });
});

// ---------- CARD SEARCH ----------
app.get('/api/cards/search', async (req, res) => {
  try {
    const { game, q, limit = 20 } = req.query;
    if (!game || !q) {
      return res.status(400).json({ error: 'Missing game or q' });
    }

    const url = `${BASE_URL}/cards?q=${encodeURIComponent(q)}&game=${game}&limit=${limit}`;
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

    // CLEAN DATA: Use card.image if available, fallback to variant
    const cards = rawCards.map(card => {
      const variant = card.variants?.[0] || {};
      const fallbackImage = card.image || variant.image || null;

      return {
        id: card.id,
        name: card.name,
        set_name: card.set_name || card.set,
        set: card.set,
        number: card.number,
        image: fallbackImage,  // ← Use card.image or variant.image
        price: variant.price || 0
      };
    });

    res.json({ data: cards });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- SINGLE CARD PRICE + IMAGE ----------
app.get('/api/cards/price', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const url = `${BASE_URL}/cards/${id}`;
    const response = await fetch(url, {
      headers: { 'X-API-Key': JUSTTCG_API_KEY }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err.error || 'Card not found' });
    }

    const card = await response.json();
    const variant = card.variants?.[0] || {};
    const image = card.image || variant.image || null;

    res.json({ 
      price: variant.price || 0,
      image: image  // ← Return image too
    });
  } catch (err) {
    console.error('Price error:', err);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// ---------- OPTIONAL: LIST GAMES ----------
app.get('/api/games', async (req, res) => {
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
