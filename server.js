// server.js - TCG Inventory Tracker Backend
// Install dependencies: npm install express cors dotenv node-fetch@2

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// JustTCG API Configuration
const JUSTTCG_API_KEY = process.env.JUSTTCG_API_KEY || 'tcg_052679f66e0f462d8f1606ffb601dd72';
const BASE_URL = 'https://api.justtcg.com/v1';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend is running' });
});

// Search cards endpoint
app.get('/api/cards/search', async (req, res) => {
  try {
    const { game, q, limit = 20 } = req.query;

    if (!game || !q) {
      return res.status(400).json({ 
        error: 'Missing required parameters: game and q' 
      });
    }

    const url = `${BASE_URL}/cards?game=${game}&q=${encodeURIComponent(q)}&limit=${limit}`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.error || 'JustTCG API error' 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Batch card lookup endpoint (for price refresh)
app.post('/api/cards/batch', async (req, res) => {
  try {
    const { cards } = req.body;

    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ 
        error: 'Invalid request: cards array required' 
      });
    }

    // Limit batch size
    if (cards.length > 20) {
      return res.status(400).json({ 
        error: 'Batch size cannot exceed 20 cards' 
      });
    }

    const response = await fetch(`${BASE_URL}/cards`, {
      method: 'POST',
      headers: {
        'x-api-key': JUSTTCG_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cards)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.error || 'JustTCG API error' 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Batch lookup error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Get all games
app.get('/api/games', async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/games`, {
      headers: {
        'x-api-key': JUSTTCG_API_KEY
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: errorData.error || 'JustTCG API error' 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Games error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TCG Backend Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Using API Key: ${JUSTTCG_API_KEY.substring(0, 10)}...`);
});

module.exports = app;