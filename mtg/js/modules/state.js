// state.js - Central state management with change tracking

let _collection = {};
let _decks = [];
let _binders = [];
let _cardCache = {};
let _changeLog = {
    collection_changes: [],
    deck_changes: [],
    binder_changes: []
};
let _hasUnsavedChanges = false;
let _listeners = [];

// --- Helpers ---

// Extract the real Scryfall ID from a possibly-composite key (e.g. "id:foil" -> "id")
export function getRealScryfallId(key) {
    const colonIdx = key.indexOf(':');
    return colonIdx !== -1 ? key.substring(0, colonIdx) : key;
}

// --- Getters ---

export function getCollection() { return _collection; }
export function getDecks() { return _decks; }
export function getBinders() { return _binders; }
export function getCardData(key) {
    return _cardCache[key] || _cardCache[getRealScryfallId(key)] || null;
}
export function getAllCardData() { return _cardCache; }
export function hasUnsavedChanges() { return _hasUnsavedChanges; }
export function getChangeLog() { return _changeLog; }

// --- Initialization ---

export function initState(collection, decks, binders) {
    _collection = collection || {};
    _decks = decks || [];
    _binders = binders || [];
    _changeLog = { collection_changes: [], deck_changes: [], binder_changes: [] };
    _hasUnsavedChanges = false;
    notify('init');
}

export function setCardCache(cardsMap) {
    Object.assign(_cardCache, cardsMap);
}

export function getCardCacheEntry(scryfallId) {
    return _cardCache[scryfallId] || null;
}

// --- Observer Pattern ---

export function subscribe(listener) {
    _listeners.push(listener);
    return () => {
        _listeners = _listeners.filter(l => l !== listener);
    };
}

function notify(eventType, data) {
    for (const listener of _listeners) {
        try {
            listener(eventType, data);
        } catch (e) {
            console.error('State listener error:', e);
        }
    }
}

function markChanged() {
    _hasUnsavedChanges = true;
    notify('unsaved_changes');
}

// --- Collection Mutations ---

export function addToCollection(scryfallId, quantity, cardInfo) {
    if (_collection[scryfallId]) {
        _collection[scryfallId].quantity += quantity;
        _changeLog.collection_changes.push({
            action: 'update_quantity',
            scryfall_id: scryfallId,
            new_quantity: _collection[scryfallId].quantity
        });
    } else {
        _collection[scryfallId] = {
            quantity,
            oracle_id: cardInfo.oracle_id,
            name: cardInfo.name,
            set: cardInfo.set,
            collector_number: cardInfo.collector_number
        };
        _changeLog.collection_changes.push({
            action: 'add',
            scryfall_id: scryfallId,
            quantity,
            oracle_id: cardInfo.oracle_id,
            name: cardInfo.name,
            set: cardInfo.set,
            collector_number: cardInfo.collector_number
        });
    }
    markChanged();
    notify('collection_changed', { scryfallId });
}

export function updateCollectionQuantity(scryfallId, newQuantity) {
    if (!_collection[scryfallId]) return;
    if (newQuantity <= 0) {
        removeFromCollection(scryfallId);
        return;
    }
    _collection[scryfallId].quantity = newQuantity;
    _changeLog.collection_changes.push({
        action: 'update_quantity',
        scryfall_id: scryfallId,
        new_quantity: newQuantity
    });
    markChanged();
    notify('collection_changed', { scryfallId });
}

export function removeFromCollection(scryfallId) {
    if (!_collection[scryfallId]) return;
    delete _collection[scryfallId];
    _changeLog.collection_changes.push({
        action: 'remove',
        scryfall_id: scryfallId
    });
    markChanged();
    notify('collection_changed', { scryfallId });
}

// --- Deck Mutations ---

export function createDeck(name, format, description) {
    const id = 'deck-' + Date.now();
    const deck = { id, name, format: format || '', description: description || '', cards: [] };
    _decks.push(deck);
    _changeLog.deck_changes.push({ action: 'create', deck: structuredClone(deck) });
    markChanged();
    notify('decks_changed', { deckId: id });
    return id;
}

export function updateDeck(deckId, updatedDeck) {
    const idx = _decks.findIndex(d => d.id === deckId);
    if (idx === -1) return;
    _decks[idx] = { ...updatedDeck, id: deckId };
    _changeLog.deck_changes.push({ action: 'update', deck_id: deckId, deck: structuredClone(_decks[idx]) });
    markChanged();
    notify('decks_changed', { deckId });
}

export function deleteDeck(deckId) {
    _decks = _decks.filter(d => d.id !== deckId);
    _changeLog.deck_changes.push({ action: 'delete', deck_id: deckId });
    markChanged();
    notify('decks_changed', { deckId });
}

export function getDeckById(deckId) {
    return _decks.find(d => d.id === deckId) || null;
}

// --- Binder Mutations ---

export function createBinder(name, description, pages, slotsPerPage) {
    const id = 'binder-' + Date.now();
    const binder = {
        id, name,
        description: description || '',
        pages: pages || 9,
        slots_per_page: slotsPerPage || 9,
        cards: []
    };
    _binders.push(binder);
    _changeLog.binder_changes.push({ action: 'create', binder: structuredClone(binder) });
    markChanged();
    notify('binders_changed', { binderId: id });
    return id;
}

export function updateBinder(binderId, updatedBinder) {
    const idx = _binders.findIndex(b => b.id === binderId);
    if (idx === -1) return;
    _binders[idx] = { ...updatedBinder, id: binderId };
    _changeLog.binder_changes.push({ action: 'update', binder_id: binderId, binder: structuredClone(_binders[idx]) });
    markChanged();
    notify('binders_changed', { binderId });
}

export function deleteBinder(binderId) {
    _binders = _binders.filter(b => b.id !== binderId);
    _changeLog.binder_changes.push({ action: 'delete', binder_id: binderId });
    markChanged();
    notify('binders_changed', { binderId });
}

export function getBinderById(binderId) {
    return _binders.find(b => b.id === binderId) || null;
}

// --- Derived Data ---

export function getCardAllocation(scryfallId) {
    const entry = _collection[scryfallId];
    const total = entry ? entry.quantity : 0;

    const deckAllocations = [];
    for (const deck of _decks) {
        for (const card of deck.cards) {
            if (card.scryfall_id === scryfallId) {
                deckAllocations.push({ deckId: deck.id, deckName: deck.name, quantity: card.quantity, board: card.board });
            }
        }
    }

    const binderAllocations = [];
    for (const binder of _binders) {
        for (const card of binder.cards) {
            if (card.scryfall_id === scryfallId) {
                binderAllocations.push({ binderId: binder.id, binderName: binder.name, quantity: card.quantity, position: card.position });
            }
        }
    }

    const assigned = deckAllocations.reduce((sum, a) => sum + a.quantity, 0)
        + binderAllocations.reduce((sum, a) => sum + a.quantity, 0);

    return {
        total,
        assigned,
        unassigned: Math.max(0, total - assigned),
        decks: deckAllocations,
        binders: binderAllocations,
        overAllocated: assigned > total
    };
}

// --- Reset ---

export function resetChangeLog() {
    _changeLog = { collection_changes: [], deck_changes: [], binder_changes: [] };
    _hasUnsavedChanges = false;
    notify('unsaved_changes');
}
