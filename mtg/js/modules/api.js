// api.js - Scryfall API client with rate limiting and caching

const BASE_URL = 'https://api.scryfall.com';
const RATE_LIMIT_MS = 100;
const BATCH_SIZE = 75;
const CACHE_KEY = 'mtg_card_cache';
const CACHE_VERSION = 1;

let _lastRequestTime = 0;

async function rateLimitedFetch(url, options = {}) {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed < RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
    _lastRequestTime = Date.now();

    const response = await fetch(url, {
        ...options,
        headers: {
            'Accept': 'application/json',
            ...(options.headers || {})
        }
    });

    if (response.status === 429) {
        // Rate limited - wait and retry once
        await new Promise(resolve => setTimeout(resolve, 1000));
        _lastRequestTime = Date.now();
        return fetch(url, options);
    }

    return response;
}

// Extract only the fields we need from a Scryfall card object
export function extractCardFields(card) {
    return {
        id: card.id,
        oracle_id: card.oracle_id,
        name: card.name,
        mana_cost: card.mana_cost || '',
        cmc: card.cmc || 0,
        type_line: card.type_line || '',
        oracle_text: card.oracle_text || '',
        colors: card.colors || [],
        color_identity: card.color_identity || [],
        set: card.set,
        set_name: card.set_name || '',
        collector_number: card.collector_number || '',
        rarity: card.rarity || '',
        image_uris: card.image_uris || null,
        card_faces: card.card_faces ? card.card_faces.map(f => ({
            name: f.name,
            mana_cost: f.mana_cost || '',
            type_line: f.type_line || '',
            oracle_text: f.oracle_text || '',
            image_uris: f.image_uris || null,
            power: f.power,
            toughness: f.toughness
        })) : null,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        prices: {
            usd: card.prices?.usd || null,
            usd_foil: card.prices?.usd_foil || null,
            eur: card.prices?.eur || null
        },
        legalities: card.legalities || {}
    };
}

// Get image URI, handling multi-faced cards
export function getCardImageUri(cardData, size = 'normal', faceIndex = 0) {
    if (!cardData) return null;

    if (cardData.image_uris && cardData.image_uris[size]) {
        return cardData.image_uris[size];
    }

    if (cardData.card_faces && cardData.card_faces[faceIndex]) {
        const face = cardData.card_faces[faceIndex];
        if (face.image_uris && face.image_uris[size]) {
            return face.image_uris[size];
        }
    }

    // Fallback sizes
    const fallbacks = ['normal', 'small', 'large', 'border_crop'];
    for (const fb of fallbacks) {
        if (fb === size) continue;
        if (cardData.image_uris && cardData.image_uris[fb]) return cardData.image_uris[fb];
        if (cardData.card_faces && cardData.card_faces[faceIndex]?.image_uris?.[fb]) {
            return cardData.card_faces[faceIndex].image_uris[fb];
        }
    }

    return null;
}

// Check if a card is multi-faced
export function isMultiFaced(cardData) {
    return cardData && cardData.card_faces && cardData.card_faces.length > 1 && !cardData.image_uris;
}

// Fetch card details in batches of 75
export async function fetchCardsBatch(scryfallIds, onProgress) {
    const results = {};
    const total = scryfallIds.length;
    let fetched = 0;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = scryfallIds.slice(i, i + BATCH_SIZE);
        const identifiers = batch.map(id => ({ id }));

        try {
            const response = await rateLimitedFetch(`${BASE_URL}/cards/collection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiers })
            });

            if (!response.ok) {
                console.error(`Batch fetch failed (${response.status}):`, await response.text());
                continue;
            }

            const data = await response.json();

            if (data.data) {
                for (const card of data.data) {
                    results[card.id] = extractCardFields(card);
                }
            }

            if (data.not_found && data.not_found.length > 0) {
                console.warn('Cards not found:', data.not_found);
            }
        } catch (err) {
            console.error('Batch fetch error:', err);
        }

        fetched += batch.length;
        if (onProgress) {
            onProgress(fetched, total);
        }
    }

    return results;
}

// Search cards
export async function searchCards(query, page = 1, unique = 'cards') {
    const params = new URLSearchParams({
        q: query,
        unique,
        page: String(page),
        format: 'json'
    });

    try {
        const response = await rateLimitedFetch(`${BASE_URL}/cards/search?${params}`);

        if (response.status === 404) {
            return { data: [], has_more: false, total_cards: 0 };
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.details || `Search failed: ${response.status}`);
        }

        const result = await response.json();
        return {
            data: (result.data || []).map(extractCardFields),
            has_more: result.has_more || false,
            total_cards: result.total_cards || 0
        };
    } catch (err) {
        console.error('Search error:', err);
        throw err;
    }
}

// Fetch a single card by ID
export async function fetchCard(scryfallId) {
    try {
        const response = await rateLimitedFetch(`${BASE_URL}/cards/${scryfallId}`);
        if (!response.ok) return null;
        const card = await response.json();
        return extractCardFields(card);
    } catch (err) {
        console.error('Fetch card error:', err);
        return null;
    }
}

// Search for all printings of a card by name
export async function fetchPrintings(cardName) {
    const query = `!"${cardName}"`;
    return searchCards(query, 1, 'prints');
}

// --- localStorage Cache ---

export function loadCacheFromStorage() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return {};
        const cached = JSON.parse(raw);
        if (cached.version !== CACHE_VERSION) {
            localStorage.removeItem(CACHE_KEY);
            return {};
        }
        return cached.cards || {};
    } catch (e) {
        console.warn('Cache load failed:', e);
        return {};
    }
}

export function saveCacheToStorage(cardsMap) {
    try {
        const payload = {
            version: CACHE_VERSION,
            cached_at: new Date().toISOString(),
            cards: cardsMap
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.warn('Cache save failed (storage full?):', e);
    }
}

export function clearCache() {
    localStorage.removeItem(CACHE_KEY);
}
