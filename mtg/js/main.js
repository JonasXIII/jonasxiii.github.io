// main.js - MTG Collection Manager entry point

import * as state from './modules/state.js';
import * as api from './modules/api.js';
import { downloadChangesJson } from './modules/export.js';
import { showToast } from './modules/ui-components.js';
import { render as renderCollection } from './modules/ui-collection.js';
import { render as renderDecks } from './modules/ui-deck-editor.js';
import { render as renderBinders } from './modules/ui-binder-editor.js';

let _activeTab = 'collection';

document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupSaveButton();
    setupBeforeUnload();
    await loadData();
});

async function loadData() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.getElementById('loading-progress');

    try {
        // Load JSON data files in parallel
        loadingText.textContent = 'Loading collection data...';
        loadingProgress.style.width = '10%';

        const [collectionData, decksData, bindersData] = await Promise.all([
            fetchJson('./data/collection.json'),
            fetchJson('./data/decks.json'),
            fetchJson('./data/binders.json')
        ]);

        loadingProgress.style.width = '30%';

        // Initialize state
        state.initState(collectionData, decksData, bindersData);

        // Load localStorage cache
        loadingText.textContent = 'Loading card cache...';
        const cachedCards = api.loadCacheFromStorage();
        state.setCardCache(cachedCards);

        // Determine which IDs need fetching
        const allIds = collectAllScryfallIds(collectionData, decksData, bindersData);
        const missingIds = allIds.filter(id => !cachedCards[id]);

        if (missingIds.length > 0) {
            loadingText.textContent = `Fetching ${missingIds.length} cards from Scryfall...`;
            loadingProgress.style.width = '40%';

            const fetchedCards = await api.fetchCardsBatch(missingIds, (fetched, total) => {
                const pct = 40 + (fetched / total) * 50;
                loadingProgress.style.width = pct + '%';
                loadingText.textContent = `Fetching cards... ${fetched}/${total}`;
            });

            // Merge into state and save cache
            state.setCardCache(fetchedCards);
            const allCached = { ...cachedCards, ...fetchedCards };
            api.saveCacheToStorage(allCached);
        }

        loadingProgress.style.width = '100%';
        loadingText.textContent = 'Ready!';

        // Hide loading overlay
        setTimeout(() => {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        }, 300);

        // Render initial view
        renderActiveTab();

    } catch (err) {
        console.error('Failed to load data:', err);
        if (loadingText) loadingText.textContent = 'Error loading data. Check console for details.';
        if (loadingProgress) loadingProgress.style.backgroundColor = '#f56565';
    }
}

async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to load ${url} (${response.status}), using default`);
            return url.includes('collection') ? {} : [];
        }
        return await response.json();
    } catch (err) {
        console.warn(`Error loading ${url}:`, err);
        return url.includes('collection') ? {} : [];
    }
}

function collectAllScryfallIds(collection, decks, binders) {
    const ids = new Set();

    // From collection
    for (const id of Object.keys(collection || {})) {
        ids.add(id);
    }

    // From decks
    for (const deck of (decks || [])) {
        for (const card of (deck.cards || [])) {
            ids.add(card.scryfall_id);
        }
    }

    // From binders
    for (const binder of (binders || [])) {
        for (const card of (binder.cards || [])) {
            ids.add(card.scryfall_id);
        }
    }

    return Array.from(ids);
}

// --- Tab Navigation ---

function setupTabs() {
    const tabs = document.querySelectorAll('.mtg-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            if (tabName === _activeTab) return;

            // Update tab buttons
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Update tab content
            document.querySelectorAll('.mtg-tab-content').forEach(tc => tc.classList.remove('active'));
            const content = document.getElementById('tab-' + tabName);
            if (content) content.classList.add('active');

            _activeTab = tabName;
            renderActiveTab();
        });
    });
}

function renderActiveTab() {
    switch (_activeTab) {
        case 'collection':
            renderCollection();
            break;
        case 'decks':
            renderDecks();
            break;
        case 'binders':
            renderBinders();
            break;
    }
}

// --- Save Button ---

function setupSaveButton() {
    const saveBtn = document.getElementById('save-changes-btn');
    if (!saveBtn) return;

    saveBtn.addEventListener('click', () => {
        const changes = downloadChangesJson();
        showToast('changes.json downloaded. Run apply_changes.py to apply.', 'success', 5000);
    });

    // Show/hide based on unsaved changes
    state.subscribe((eventType) => {
        if (eventType === 'unsaved_changes' || eventType === 'collection_changed' ||
            eventType === 'decks_changed' || eventType === 'binders_changed') {
            saveBtn.style.display = state.hasUnsavedChanges() ? 'block' : 'none';
        }
    });
}

// --- Unsaved Changes Warning ---

function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}
