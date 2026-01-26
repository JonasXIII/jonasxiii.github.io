// collection.js - Collection data operations

import * as state from './state.js';

export function addCard(scryfallId, quantity, cardData) {
    state.addToCollection(scryfallId, quantity, {
        oracle_id: cardData.oracle_id,
        name: cardData.name,
        set: cardData.set,
        collector_number: cardData.collector_number
    });
    // Also cache the full card data
    state.setCardCache({ [scryfallId]: cardData });
}

export function removeCard(scryfallId) {
    state.removeFromCollection(scryfallId);
}

export function setQuantity(scryfallId, qty) {
    state.updateCollectionQuantity(scryfallId, qty);
}

// Get all collection entries with their cached card data
export function getCollectionWithData() {
    const collection = state.getCollection();
    const entries = [];
    for (const [scryfallId, entry] of Object.entries(collection)) {
        const cardData = state.getCardData(scryfallId);
        entries.push({
            scryfallId,
            ...entry,
            cardData
        });
    }
    return entries;
}

// Group collection by oracle_id (all printings of same card together)
export function getGroupedByCard() {
    const collection = state.getCollection();
    const groups = {};
    for (const [scryfallId, entry] of Object.entries(collection)) {
        const key = entry.oracle_id || scryfallId;
        if (!groups[key]) {
            groups[key] = {
                oracle_id: entry.oracle_id,
                name: entry.name,
                totalQuantity: 0,
                printings: []
            };
        }
        groups[key].totalQuantity += entry.quantity;
        groups[key].printings.push({
            scryfallId,
            ...entry,
            cardData: state.getCardData(scryfallId)
        });
    }
    return Object.values(groups);
}

// Filter collection entries
export function filterCollection(entries, filters) {
    return entries.filter(entry => {
        const cd = entry.cardData;
        if (!cd) return true; // Don't filter out entries without cached data

        // Name filter
        if (filters.name) {
            const nameLC = filters.name.toLowerCase();
            if (!cd.name.toLowerCase().includes(nameLC)) return false;
        }

        // Color filter (any of the selected colors)
        if (filters.colors && filters.colors.length > 0) {
            const cardColors = cd.colors || [];
            if (filters.colorMode === 'exact') {
                if (cardColors.length !== filters.colors.length ||
                    !filters.colors.every(c => cardColors.includes(c))) return false;
            } else {
                // 'include' mode - card has at least one of the selected colors
                if (cardColors.length === 0 && !filters.colors.includes('C')) return false;
                if (cardColors.length > 0 && !filters.colors.some(c => cardColors.includes(c))) return false;
            }
        }

        // Type filter
        if (filters.type && filters.type !== 'all') {
            if (!cd.type_line.toLowerCase().includes(filters.type.toLowerCase())) return false;
        }

        // Set filter
        if (filters.set && filters.set !== 'all') {
            if (cd.set !== filters.set) return false;
        }

        // Rarity filter
        if (filters.rarity && filters.rarity !== 'all') {
            if (cd.rarity !== filters.rarity) return false;
        }

        // CMC range
        if (filters.minCmc !== undefined && filters.minCmc !== null) {
            if (cd.cmc < filters.minCmc) return false;
        }
        if (filters.maxCmc !== undefined && filters.maxCmc !== null) {
            if (cd.cmc > filters.maxCmc) return false;
        }

        return true;
    });
}

// Sort collection entries
export function sortCollection(entries, sortBy = 'name', direction = 'asc') {
    const sorted = [...entries];
    sorted.sort((a, b) => {
        const cdA = a.cardData || {};
        const cdB = b.cardData || {};
        let cmp = 0;

        switch (sortBy) {
            case 'name':
                cmp = (cdA.name || a.name || '').localeCompare(cdB.name || b.name || '');
                break;
            case 'cmc':
                cmp = (cdA.cmc || 0) - (cdB.cmc || 0);
                break;
            case 'color':
                cmp = (cdA.colors || []).join('').localeCompare((cdB.colors || []).join(''));
                break;
            case 'set':
                cmp = (cdA.set || a.set || '').localeCompare(cdB.set || b.set || '');
                break;
            case 'rarity': {
                const rarityOrder = { mythic: 0, rare: 1, uncommon: 2, common: 3, special: 4, bonus: 5 };
                cmp = (rarityOrder[cdA.rarity] ?? 9) - (rarityOrder[cdB.rarity] ?? 9);
                break;
            }
            case 'price': {
                const priceA = parseFloat(cdA.prices?.usd) || 0;
                const priceB = parseFloat(cdB.prices?.usd) || 0;
                cmp = priceA - priceB;
                break;
            }
            case 'quantity':
                cmp = (a.quantity || 0) - (b.quantity || 0);
                break;
            default:
                cmp = 0;
        }

        return direction === 'desc' ? -cmp : cmp;
    });
    return sorted;
}

// Get unique sets in the collection
export function getUniqueSets() {
    const collection = state.getCollection();
    const sets = new Map();
    for (const [scryfallId, entry] of Object.entries(collection)) {
        const cd = state.getCardData(scryfallId);
        if (cd) {
            sets.set(cd.set, cd.set_name);
        }
    }
    return Array.from(sets.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}

// Get collection stats
export function getStats() {
    const collection = state.getCollection();
    const entries = Object.values(collection);
    return {
        uniqueCards: entries.length,
        totalCards: entries.reduce((sum, e) => sum + e.quantity, 0)
    };
}
