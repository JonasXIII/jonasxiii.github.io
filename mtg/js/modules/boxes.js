// boxes.js - Box CRUD and card management

import * as state from './state.js';

export function create(name, description, color, unlocked) {
    return state.createBox(name, description || '', color || null, unlocked || false);
}

export function remove(boxId) {
    state.deleteBox(boxId);
}

export function getAll() {
    return state.getBoxes();
}

export function getById(boxId) {
    return state.getBoxById(boxId);
}

export function rename(boxId, newName) {
    const box = state.getBoxById(boxId);
    if (!box) return;
    state.updateBox(boxId, { ...box, name: newName });
}

export function setColor(boxId, color) {
    const box = state.getBoxById(boxId);
    if (!box) return;
    state.updateBox(boxId, { ...box, color });
}

export function setUnlocked(boxId, unlocked) {
    const box = state.getBoxById(boxId);
    if (!box) return;
    state.updateBox(boxId, { ...box, unlocked });
}

export function addCard(boxId, scryfallId, quantity) {
    const box = state.getBoxById(boxId);
    if (!box) return;

    const existing = box.cards.find(c => c.scryfall_id === scryfallId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        box.cards.push({ scryfall_id: scryfallId, quantity });
    }
    state.updateBox(boxId, box);
}

export function removeCard(boxId, scryfallId) {
    const box = state.getBoxById(boxId);
    if (!box) return;
    box.cards = box.cards.filter(c => c.scryfall_id !== scryfallId);
    state.updateBox(boxId, box);
}

export function setCardQuantity(boxId, scryfallId, quantity) {
    const box = state.getBoxById(boxId);
    if (!box) return;
    if (quantity <= 0) {
        removeCard(boxId, scryfallId);
        return;
    }
    const existing = box.cards.find(c => c.scryfall_id === scryfallId);
    if (existing) {
        existing.quantity = quantity;
        state.updateBox(boxId, box);
    }
}

export function getTotalCards(boxId) {
    const box = state.getBoxById(boxId);
    if (!box) return 0;
    return box.cards.reduce((sum, c) => sum + c.quantity, 0);
}

export function getCardsWithData(boxId) {
    const box = state.getBoxById(boxId);
    if (!box) return [];
    return box.cards.map(card => ({
        ...card,
        cardData: state.getCardData(card.scryfall_id)
    })).sort((a, b) => {
        const nameA = a.cardData?.name || '';
        const nameB = b.cardData?.name || '';
        return nameA.localeCompare(nameB);
    });
}
