// state.js - Central state management, backed by Firestore.
//
// Every mutation here keeps its old synchronous signature (no caller anywhere
// else in the app had to change) - it updates the in-memory state instantly
// (optimistic UI), then fires off a Firestore write in the background,
// catching failures with a toast rather than losing the edit silently.
// Firestore's own offline queue (see firebase.js) handles the "made a change
// with no wifi" case automatically.
import {
  collection as fsCollection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';
import { db, OWNER_UID } from './firebase.js';
import { isOwner } from './auth.js';
import { showToast } from './ui-components.js';

let _collection = {};
let _decks = [];
let _binders = [];
let _boxes = [];
let _cardCache = {};
let _listeners = [];

// --- Helpers ---

// Extract the real Scryfall ID from a possibly-composite key (e.g. "id:foil" -> "id")
export function getRealScryfallId(key) {
    const colonIdx = key.indexOf(':');
    return colonIdx !== -1 ? key.substring(0, colonIdx) : key;
}

// --- Constants ---

export const MAX_UNLOCKED = 6;

// --- Getters ---

export function getCollection() { return _collection; }
export function getDecks() { return _decks; }
export function getBinders() { return _binders; }
export function getBoxes() { return _boxes; }
export function getCardData(key) {
    return _cardCache[key] || _cardCache[getRealScryfallId(key)] || null;
}
export function getAllCardData() { return _cardCache; }

// --- Initialization ---

export function initState(collection, decks, binders, boxes) {
    _collection = collection || {};
    _decks = decks || [];
    _binders = binders || [];
    _boxes = boxes || [];
    notify('init');
}

// Reads the owner's collection/decks/binders/boxes from Firestore and seeds
// state from them - this is the direct replacement for the old
// fetch('./data/*.json') + initState() flow.
export async function loadFromFirestore() {
    const [cardsSnap, decksSnap, bindersSnap, boxesSnap] = await Promise.all([
        getDocs(collectionCardsRef()),
        getDocs(decksRef()),
        getDocs(bindersRef()),
        getDocs(boxesRef()),
    ]);
    const collection = {};
    cardsSnap.forEach((d) => { collection[d.id] = d.data(); });
    const decks = decksSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const binders = bindersSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    const boxes = boxesSnap.docs.map((d) => ({ ...d.data(), id: d.id }));
    initState(collection, decks, binders, boxes);
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

// --- Firestore write-through (fire-and-forget from the mutators below) ---

function collectionCardsRef() { return fsCollection(db, 'users', OWNER_UID, 'collectionCards'); }
function decksRef() { return fsCollection(db, 'users', OWNER_UID, 'decks'); }
function bindersRef() { return fsCollection(db, 'users', OWNER_UID, 'binders'); }
function boxesRef() { return fsCollection(db, 'users', OWNER_UID, 'boxes'); }

function requireOwner() {
    if (!isOwner()) {
        showToast('Sign in to make changes.', 'error', 3000);
        return false;
    }
    return true;
}

function reportSyncFailure(err) {
    console.error('Firestore sync failed:', err);
    showToast("Couldn't reach the database - your change will sync once you're back online.", 'error', 4000);
}

function syncCollectionCard(scryfallId, entry) {
    setDoc(doc(collectionCardsRef(), scryfallId), entry).catch(reportSyncFailure);
}
function syncDeleteCollectionCard(scryfallId) {
    deleteDoc(doc(collectionCardsRef(), scryfallId)).catch(reportSyncFailure);
}
function syncDeck(deck) {
    setDoc(doc(decksRef(), deck.id), deck).catch(reportSyncFailure);
}
function syncDeleteDeck(deckId) {
    deleteDoc(doc(decksRef(), deckId)).catch(reportSyncFailure);
}
function syncBinder(binder) {
    setDoc(doc(bindersRef(), binder.id), binder).catch(reportSyncFailure);
}
function syncDeleteBinder(binderId) {
    deleteDoc(doc(bindersRef(), binderId)).catch(reportSyncFailure);
}
function syncBox(box) {
    setDoc(doc(boxesRef(), box.id), box).catch(reportSyncFailure);
}
function syncDeleteBox(boxId) {
    deleteDoc(doc(boxesRef(), boxId)).catch(reportSyncFailure);
}

// --- Collection Mutations ---

export function addToCollection(scryfallId, quantity, cardInfo) {
    if (!requireOwner()) return;
    if (_collection[scryfallId]) {
        _collection[scryfallId].quantity += quantity;
    } else {
        _collection[scryfallId] = {
            quantity,
            oracle_id: cardInfo.oracle_id,
            name: cardInfo.name,
            set: cardInfo.set,
            collector_number: cardInfo.collector_number
        };
    }
    notify('collection_changed', { scryfallId });
    syncCollectionCard(scryfallId, _collection[scryfallId]);
}

export function updateCollectionQuantity(scryfallId, newQuantity) {
    if (!_collection[scryfallId]) return;
    if (newQuantity <= 0) {
        removeFromCollection(scryfallId);
        return;
    }
    if (!requireOwner()) return;
    _collection[scryfallId].quantity = newQuantity;
    notify('collection_changed', { scryfallId });
    syncCollectionCard(scryfallId, _collection[scryfallId]);
}

export function removeFromCollection(scryfallId) {
    if (!_collection[scryfallId]) return;
    if (!requireOwner()) return;
    delete _collection[scryfallId];
    notify('collection_changed', { scryfallId });
    syncDeleteCollectionCard(scryfallId);
}

// --- Deck Mutations ---

export function createDeck(name, format, description, color, unlocked) {
    if (!requireOwner()) return;
    const id = 'deck-' + Date.now();
    const deck = { id, name, format: format || '', description: description || '', color: color || null, unlocked: unlocked || false, cards: [] };
    _decks.push(deck);
    notify('decks_changed', { deckId: id });
    syncDeck(deck);
    return id;
}

export function updateDeck(deckId, updatedDeck) {
    const idx = _decks.findIndex(d => d.id === deckId);
    if (idx === -1) return;
    if (!requireOwner()) return;
    _decks[idx] = { ...updatedDeck, id: deckId };
    notify('decks_changed', { deckId });
    syncDeck(_decks[idx]);
}

export function deleteDeck(deckId) {
    if (!requireOwner()) return;
    _decks = _decks.filter(d => d.id !== deckId);
    notify('decks_changed', { deckId });
    syncDeleteDeck(deckId);
}

export function getDeckById(deckId) {
    return _decks.find(d => d.id === deckId) || null;
}

// --- Binder Mutations ---

export function createBinder(name, description, pages, slotsPerPage, color, unlocked) {
    if (!requireOwner()) return;
    const id = 'binder-' + Date.now();
    const binder = {
        id, name,
        description: description || '',
        pages: pages || 9,
        slots_per_page: slotsPerPage || 9,
        color: color || null,
        unlocked: unlocked || false,
        trade: false,
        cards: []
    };
    _binders.push(binder);
    notify('binders_changed', { binderId: id });
    syncBinder(binder);
    return id;
}

export function updateBinder(binderId, updatedBinder) {
    const idx = _binders.findIndex(b => b.id === binderId);
    if (idx === -1) return;
    if (!requireOwner()) return;
    _binders[idx] = { ...updatedBinder, id: binderId };
    notify('binders_changed', { binderId });
    syncBinder(_binders[idx]);
}

export function deleteBinder(binderId) {
    if (!requireOwner()) return;
    _binders = _binders.filter(b => b.id !== binderId);
    notify('binders_changed', { binderId });
    syncDeleteBinder(binderId);
}

export function getBinderById(binderId) {
    return _binders.find(b => b.id === binderId) || null;
}

// --- Box Mutations ---

export function createBox(name, description, color, unlocked) {
    if (!requireOwner()) return;
    const id = 'box-' + Date.now();
    const box = {
        id, name,
        description: description || '',
        color: color || null,
        unlocked: unlocked || false,
        cards: []
    };
    _boxes.push(box);
    notify('boxes_changed', { boxId: id });
    syncBox(box);
    return id;
}

export function updateBox(boxId, updatedBox) {
    const idx = _boxes.findIndex(b => b.id === boxId);
    if (idx === -1) return;
    if (!requireOwner()) return;
    _boxes[idx] = { ...updatedBox, id: boxId };
    notify('boxes_changed', { boxId });
    syncBox(_boxes[idx]);
}

export function deleteBox(boxId) {
    if (!requireOwner()) return;
    _boxes = _boxes.filter(b => b.id !== boxId);
    notify('boxes_changed', { boxId });
    syncDeleteBox(boxId);
}

export function getBoxById(boxId) {
    return _boxes.find(b => b.id === boxId) || null;
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

    const boxAllocations = [];
    for (const box of _boxes) {
        for (const card of box.cards) {
            if (card.scryfall_id === scryfallId) {
                boxAllocations.push({ boxId: box.id, boxName: box.name, quantity: card.quantity });
            }
        }
    }

    const assigned = deckAllocations.reduce((sum, a) => sum + a.quantity, 0)
        + binderAllocations.reduce((sum, a) => sum + a.quantity, 0)
        + boxAllocations.reduce((sum, a) => sum + a.quantity, 0);

    return {
        total,
        assigned,
        unassigned: Math.max(0, total - assigned),
        decks: deckAllocations,
        binders: binderAllocations,
        boxes: boxAllocations,
        overAllocated: assigned > total
    };
}

// --- Unlocked Collections ---

export function getUnlockedCollections() {
    const unlockedDecks = _decks.filter(d => d.unlocked);
    const unlockedBinders = _binders.filter(b => b.unlocked);
    const unlockedBoxes = _boxes.filter(b => b.unlocked);
    return [...unlockedDecks, ...unlockedBinders, ...unlockedBoxes];
}

export function countUnlocked() {
    return _decks.filter(d => d.unlocked).length + _binders.filter(b => b.unlocked).length + _boxes.filter(b => b.unlocked).length;
}

export function getCollectionsForCard(scryfallId) {
    const result = [];
    for (const deck of _decks) {
        if (deck.cards.some(c => c.scryfall_id === scryfallId)) {
            result.push({ type: 'deck', id: deck.id, name: deck.name, color: deck.color });
        }
    }
    for (const binder of _binders) {
        if (binder.cards.some(c => c.scryfall_id === scryfallId)) {
            result.push({ type: 'binder', id: binder.id, name: binder.name, color: binder.color });
        }
    }
    for (const box of _boxes) {
        if (box.cards.some(c => c.scryfall_id === scryfallId)) {
            result.push({ type: 'box', id: box.id, name: box.name, color: box.color });
        }
    }
    return result;
}

// --- Foil/Finish Toggle ---

export function changeCardFinish(oldId) {
    const entry = _collection[oldId];
    if (!entry) return;
    if (!requireOwner()) return;

    const newId = oldId.endsWith(':foil') ? getRealScryfallId(oldId) : (oldId + ':foil');
    const newFinish = oldId.endsWith(':foil') ? 'nonfoil' : 'foil';

    if (_collection[newId]) {
        _collection[newId].quantity += entry.quantity;
    } else {
        _collection[newId] = { ...entry, finish: newFinish };
    }
    delete _collection[oldId];

    const changedDecks = [];
    for (const deck of _decks) {
        let changed = false;
        for (const card of deck.cards) {
            if (card.scryfall_id === oldId) { card.scryfall_id = newId; changed = true; }
        }
        if (changed) changedDecks.push(deck);
    }
    const changedBinders = [];
    for (const binder of _binders) {
        let changed = false;
        for (const card of binder.cards) {
            if (card.scryfall_id === oldId) { card.scryfall_id = newId; changed = true; }
        }
        if (changed) changedBinders.push(binder);
    }
    const changedBoxes = [];
    for (const box of _boxes) {
        let changed = false;
        for (const card of box.cards) {
            if (card.scryfall_id === oldId) { card.scryfall_id = newId; changed = true; }
        }
        if (changed) changedBoxes.push(box);
    }

    notify('collection_changed', { scryfallId: oldId, newScryfallId: newId });
    notify('decks_changed');
    notify('binders_changed');
    notify('boxes_changed');

    syncFinishChangeBatch(oldId, newId, _collection[newId], changedDecks, changedBinders, changedBoxes);
}

// One batched write so the finish change and every deck/binder/box reference
// rewrite land together (or fail together) rather than partially applying.
function syncFinishChangeBatch(oldId, newId, newEntry, changedDecks, changedBinders, changedBoxes) {
    const batch = writeBatch(db);
    batch.delete(doc(collectionCardsRef(), oldId));
    batch.set(doc(collectionCardsRef(), newId), newEntry);
    for (const deck of changedDecks) batch.set(doc(decksRef(), deck.id), deck);
    for (const binder of changedBinders) batch.set(doc(bindersRef(), binder.id), binder);
    for (const box of changedBoxes) batch.set(doc(boxesRef(), box.id), box);
    batch.commit().catch(reportSyncFailure);
}

export function getDecktopBox() {
    return _boxes.find(b => b.is_decktop) || null;
}
