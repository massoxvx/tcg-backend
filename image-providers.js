// image-providers.js
// Helper to fetch image URLs from external card image providers (PokéTCG and Scryfall for now).

const fetch = require('node-fetch');

// Optional API key for PokéTCG (set POKETCG_API_KEY in Render if you have one)
const POKETCG_KEY = process.env.POKETCG_API_KEY || null;

async function fetchPokemonImage(card) {
  try {
    const setId = card.set || '';
    const number = card.number || '';
    // Try by set id and number if available
    if (setId && number) {
      // PokéTCG set IDs are often different; attempt a flexible search by set and number
      const q = `q=set.id:${encodeURIComponent(setId)} number:${encodeURIComponent(number)}`;
      const url = `https://api.pokemontcg.io/v2/cards?${q}&pageSize=1`;
      const headers = POKETCG_KEY ? { 'X-Api-Key': POKETCG_KEY } : {};
      const r = await fetch(url, { headers });
      if (r.ok) {
        const j = await r.json();
        const first = j.data?.[0];
        if (first?.images?.large || first?.images?.small) return first.images.large || first.images.small;
      }
    }

    // Fallback: search by name
    if (card.name) {
      const q = `q=name:\"${card.name.replace(/\"/g, '\\"')}\"`;
      const url = `https://api.pokemontcg.io/v2/cards?${q}&pageSize=1`;
      const headers = POKETCG_KEY ? { 'X-Api-Key': POKETCG_KEY } : {};
      const r = await fetch(url, { headers });
      if (r.ok) {
        const j = await r.json();
        const first = j.data?.[0];
        if (first?.images?.large || first?.images?.small) return first.images.large || first.images.small;
      }
    }
  } catch (err) {
    console.error('PokéTCG fetch error:', err);
  }
  return null;
}

async function fetchScryfallImage(card) {
  try {
    // Try by exact name first (most reliable)
    if (card.name) {
      const q = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}`;
      const r = await fetch(q);
      if (r.ok) {
        const j = await r.json();
        if (j.image_uris?.normal) return j.image_uris.normal;
        if (j.image_uris?.large) return j.image_uris.large;
        if (j.card_faces?.[0]?.image_uris?.normal) return j.card_faces[0].image_uris.normal;
      }
    }

    // If name lookup failed, try set + collector number (may require mapping)
    if (card.set && card.number) {
      // Scryfall set codes differ; this may not always work but attempt a generic card search
      const query = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${card.name} set:${card.set} number:${card.number}`)}`;
      const r = await fetch(query);
      if (r.ok) {
        const j = await r.json();
        const first = j.data?.[0];
        if (first) {
          if (first.image_uris?.normal) return first.image_uris.normal;
          if (first.card_faces?.[0]?.image_uris?.normal) return first.card_faces[0].image_uris.normal;
        }
      }
    }
  } catch (err) {
    console.error('Scryfall fetch error:', err);
  }
  return null;
}

async function getImageForCard(card) {
  const game = (card.game || '').toLowerCase();

  // Quick game detection
  if (game.includes('pokemon') || (card.set && card.set.includes('pokemon'))) {
    const img = await fetchPokemonImage(card);
    if (img) return img;
  }

  if (game.includes('magic') || game.includes('mtg') || (card.set && card.set.includes('mtg'))) {
    const img = await fetchScryfallImage(card);
    if (img) return img;
  }

  // Generic attempts
  let img = await fetchPokemonImage(card);
  if (img) return img;
  img = await fetchScryfallImage(card);
  if (img) return img;

  return null;
}

module.exports = { getImageForCard, fetchPokemonImage, fetchScryfallImage }
