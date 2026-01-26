// binders.js - Binder CRUD and positional card management

import * as state from './state.js';

export function create(name, description, pages, slotsPerPage) {
    return state.createBinder(name, description || '', pages || 9, slotsPerPage || 9);
}

export function remove(binderId) {
    state.deleteBinder(binderId);
}

export function getAll() {
    return state.getBinders();
}

export function getById(binderId) {
    return state.getBinderById(binderId);
}

export function rename(binderId, newName) {
    const binder = state.getBinderById(binderId);
    if (!binder) return;
    state.updateBinder(binderId, { ...binder, name: newName });
}

export function addCard(binderId, scryfallId, quantity, position) {
    const binder = state.getBinderById(binderId);
    if (!binder) return;

    // Check if position is already occupied
    const existing = binder.cards.find(c => c.position === position);
    if (existing) {
        // Replace the card at this position
        existing.scryfall_id = scryfallId;
        existing.quantity = quantity;
    } else {
        binder.cards.push({ scryfall_id: scryfallId, quantity: quantity || 1, position });
    }
    state.updateBinder(binderId, binder);
}

export function removeCard(binderId, position) {
    const binder = state.getBinderById(binderId);
    if (!binder) return;
    binder.cards = binder.cards.filter(c => c.position !== position);
    state.updateBinder(binderId, binder);
}

export function moveCard(binderId, fromPosition, toPosition) {
    const binder = state.getBinderById(binderId);
    if (!binder) return;

    const fromCard = binder.cards.find(c => c.position === fromPosition);
    const toCard = binder.cards.find(c => c.position === toPosition);

    if (fromCard && toCard) {
        // Swap
        fromCard.position = toPosition;
        toCard.position = fromPosition;
    } else if (fromCard) {
        fromCard.position = toPosition;
    }

    state.updateBinder(binderId, binder);
}

// Get the binder as a page grid
export function getBinderGrid(binderId) {
    const binder = state.getBinderById(binderId);
    if (!binder) return [];

    const totalSlots = binder.pages * binder.slots_per_page;
    const grid = new Array(totalSlots).fill(null);

    for (const card of binder.cards) {
        if (card.position >= 0 && card.position < totalSlots) {
            grid[card.position] = {
                ...card,
                cardData: state.getCardData(card.scryfall_id)
            };
        }
    }

    return grid;
}

// Get a specific page from the binder
export function getBinderPage(binderId, pageIndex) {
    const binder = state.getBinderById(binderId);
    if (!binder) return [];

    const start = pageIndex * binder.slots_per_page;
    const grid = getBinderGrid(binderId);
    return grid.slice(start, start + binder.slots_per_page);
}

export function getTotalCards(binderId) {
    const binder = state.getBinderById(binderId);
    if (!binder) return 0;
    return binder.cards.reduce((sum, c) => sum + c.quantity, 0);
}
