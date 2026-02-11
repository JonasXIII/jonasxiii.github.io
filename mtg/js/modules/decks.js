// decks.js - Deck CRUD and card management

import * as state from './state.js';

export function create(name, format, description, color, unlocked) {
    return state.createDeck(name, format || '', description || '', color || null, unlocked || false);
}

export function remove(deckId) {
    state.deleteDeck(deckId);
}

export function getAll() {
    return state.getDecks();
}

export function getById(deckId) {
    return state.getDeckById(deckId);
}

export function rename(deckId, newName) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    state.updateDeck(deckId, { ...deck, name: newName });
}

export function setFormat(deckId, format) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    state.updateDeck(deckId, { ...deck, format });
}

export function setDescription(deckId, description) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    state.updateDeck(deckId, { ...deck, description });
}

export function setColor(deckId, color) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    state.updateDeck(deckId, { ...deck, color });
}

export function setUnlocked(deckId, unlocked) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    state.updateDeck(deckId, { ...deck, unlocked });
}

export function addCard(deckId, scryfallId, quantity, board = 'main') {
    const deck = state.getDeckById(deckId);
    if (!deck) return;

    const existing = deck.cards.find(c => c.scryfall_id === scryfallId && c.board === board);
    if (existing) {
        existing.quantity += quantity;
    } else {
        deck.cards.push({ scryfall_id: scryfallId, quantity, board });
    }
    state.updateDeck(deckId, deck);
}

export function removeCard(deckId, scryfallId, board = 'main') {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    deck.cards = deck.cards.filter(c => !(c.scryfall_id === scryfallId && c.board === board));
    state.updateDeck(deckId, deck);
}

export function setCardQuantity(deckId, scryfallId, quantity, board = 'main') {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    if (quantity <= 0) {
        removeCard(deckId, scryfallId, board);
        return;
    }
    const existing = deck.cards.find(c => c.scryfall_id === scryfallId && c.board === board);
    if (existing) {
        existing.quantity = quantity;
        state.updateDeck(deckId, deck);
    }
}

export function getCardsByBoard(deckId) {
    const deck = state.getDeckById(deckId);
    if (!deck) return { main: [], sideboard: [], maybe: [] };

    const result = { main: [], sideboard: [], maybe: [] };
    for (const card of deck.cards) {
        const board = card.board || 'main';
        if (!result[board]) result[board] = [];
        result[board].push({
            ...card,
            cardData: state.getCardData(card.scryfall_id)
        });
    }
    // Sort each board by name
    for (const board of Object.keys(result)) {
        result[board].sort((a, b) => {
            const nameA = a.cardData?.name || '';
            const nameB = b.cardData?.name || '';
            return nameA.localeCompare(nameB);
        });
    }
    return result;
}

export function getTotalCards(deckId) {
    const deck = state.getDeckById(deckId);
    if (!deck) return 0;
    return deck.cards.reduce((sum, c) => sum + c.quantity, 0);
}

// --- Custom Pile Management ---

export function getCustomPiles(deckId) {
    const deck = state.getDeckById(deckId);
    return deck?.custom_piles || [];
}

export function addCustomPile(deckId, name) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    if (!deck.custom_piles) deck.custom_piles = [];
    const id = 'pile-' + Date.now();
    deck.custom_piles.push({ id, name });
    state.updateDeck(deckId, deck);
    return id;
}

export function renameCustomPile(deckId, pileId, newName) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    const pile = (deck.custom_piles || []).find(p => p.id === pileId);
    if (pile) {
        pile.name = newName;
        state.updateDeck(deckId, deck);
    }
}

export function removeCustomPile(deckId, pileId) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    deck.custom_piles = (deck.custom_piles || []).filter(p => p.id !== pileId);
    for (const card of deck.cards) {
        if (card.custom_pile === pileId) card.custom_pile = null;
    }
    state.updateDeck(deckId, deck);
}

export function reorderCustomPiles(deckId, orderedPileIds) {
    const deck = state.getDeckById(deckId);
    if (!deck || !deck.custom_piles) return;
    const pileMap = {};
    for (const p of deck.custom_piles) pileMap[p.id] = p;
    deck.custom_piles = orderedPileIds.map(id => pileMap[id]).filter(Boolean);
    state.updateDeck(deckId, deck);
}

export function setCardCustomPile(deckId, scryfallId, board, pileId) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    const card = deck.cards.find(c => c.scryfall_id === scryfallId && c.board === board);
    if (card) {
        card.custom_pile = pileId || null;
        state.updateDeck(deckId, deck);
    }
}

export function setCustomPileSort(deckId, sortMode) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;
    deck.custom_pile_sort = sortMode;
    state.updateDeck(deckId, deck);
}

export function reorderCardInPile(deckId, scryfallId, board, newIndex) {
    const deck = state.getDeckById(deckId);
    if (!deck) return;

    const cardEntry = deck.cards.find(c => c.scryfall_id === scryfallId && c.board === board);
    if (!cardEntry) return;
    const pileId = cardEntry.custom_pile || null;

    // Get all cards in this pile, sorted by current position
    const pileCards = deck.cards
        .filter(c => c.board === board && (c.custom_pile || null) === pileId)
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

    const cardIdx = pileCards.findIndex(c => c.scryfall_id === scryfallId);
    if (cardIdx === -1) return;
    const [card] = pileCards.splice(cardIdx, 1);
    pileCards.splice(newIndex, 0, card);

    // Reassign positions
    pileCards.forEach((c, i) => {
        const dc = deck.cards.find(d => d.scryfall_id === c.scryfall_id && d.board === c.board);
        if (dc) dc.position = i;
    });

    state.updateDeck(deckId, deck);
}

export function getDeckStats(deckId) {
    const deck = state.getDeckById(deckId);
    if (!deck) return null;

    const manaCurve = {};
    const colorDist = {};
    let totalCards = 0;
    let landCount = 0;

    for (const card of deck.cards) {
        if (card.board !== 'main' && card.board !== undefined) continue;
        const cd = state.getCardData(card.scryfall_id);
        if (!cd) continue;

        totalCards += card.quantity;

        // Mana curve (exclude lands)
        if (!cd.type_line.toLowerCase().includes('land')) {
            const cmc = Math.min(Math.floor(cd.cmc), 7); // Group 7+
            manaCurve[cmc] = (manaCurve[cmc] || 0) + card.quantity;
        } else {
            landCount += card.quantity;
        }

        // Color distribution
        for (const color of (cd.colors || [])) {
            colorDist[color] = (colorDist[color] || 0) + card.quantity;
        }
        if (!cd.colors || cd.colors.length === 0) {
            colorDist['C'] = (colorDist['C'] || 0) + card.quantity;
        }
    }

    return { manaCurve, colorDist, totalCards, landCount };
}
