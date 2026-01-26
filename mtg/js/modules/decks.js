// decks.js - Deck CRUD and card management

import * as state from './state.js';

export function create(name, format, description) {
    return state.createDeck(name, format || '', description || '');
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
