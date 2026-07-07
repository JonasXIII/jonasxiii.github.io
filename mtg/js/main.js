// main.js - MTG Collection Manager entry point

import * as state from './modules/state.js';
import { getRealScryfallId } from './modules/state.js';
import * as api from './modules/api.js';
import * as auth from './modules/auth.js';
import { showToast } from './modules/ui-components.js';
import { render as renderCollection } from './modules/ui-collection.js';
import { render as renderDecks } from './modules/ui-deck-editor.js';
import { render as renderBinders } from './modules/ui-binder-editor.js';
import { render as renderBoxes } from './modules/ui-box-editor.js';

let _activeTab = 'collection';

document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupAuthUI();
    await loadData();
});

async function loadData() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const loadingProgress = document.getElementById('loading-progress');

    try {
        // Load collection/decks/binders/boxes from Firestore
        loadingText.textContent = 'Loading collection data...';
        loadingProgress.style.width = '10%';

        await state.loadFromFirestore();

        loadingProgress.style.width = '30%';

        // Load localStorage cache
        loadingText.textContent = 'Loading card cache...';
        const cachedCards = api.loadCacheFromStorage();
        state.setCardCache(cachedCards);

        // Determine which IDs need fetching (missing from cache, or cached but prices are null)
        const allIds = collectAllScryfallIds(state.getCollection(), state.getDecks(), state.getBinders(), state.getBoxes());
        const missingIds = allIds.filter(id => {
            const cached = cachedCards[id];
            if (!cached) return true;
            // Re-fetch if both price fields are null (stale cache entry)
            if (cached.prices?.usd == null && cached.prices?.usd_foil == null) return true;
            return false;
        });

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

function collectAllScryfallIds(collection, decks, binders, boxes) {
    const ids = new Set();

    // From collection (strip composite key suffixes like ":foil")
    for (const key of Object.keys(collection || {})) {
        ids.add(getRealScryfallId(key));
    }

    // From decks
    for (const deck of (decks || [])) {
        for (const card of (deck.cards || [])) {
            ids.add(getRealScryfallId(card.scryfall_id));
        }
    }

    // From binders
    for (const binder of (binders || [])) {
        for (const card of (binder.cards || [])) {
            ids.add(getRealScryfallId(card.scryfall_id));
        }
    }

    // From boxes
    for (const box of (boxes || [])) {
        for (const card of (box.cards || [])) {
            ids.add(getRealScryfallId(card.scryfall_id));
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
        case 'boxes':
            renderBoxes();
            break;
    }
}

// --- Auth UI ---
// Edits write straight to Firestore now (see state.js), so there's no more
// "unsaved changes" concept or export/apply-script loop - just sign in or out.

function setupAuthUI() {
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userLabel = document.getElementById('auth-user-label');
    if (!signInBtn || !signOutBtn) return;

    signInBtn.addEventListener('click', async () => {
        try {
            await auth.signInWithGoogle();
        } catch (err) {
            console.error('Sign-in failed:', err);
            showToast('Sign-in failed. Try again.', 'error', 3000);
        }
    });

    signOutBtn.addEventListener('click', async () => {
        try {
            await auth.signOutUser();
        } catch (err) {
            console.error('Sign-out failed:', err);
        }
    });

    auth.onAuthChange((user) => {
        signInBtn.style.display = user ? 'none' : 'inline-block';
        signOutBtn.style.display = user ? 'inline-block' : 'none';
        if (!userLabel) return;
        if (!user) {
            userLabel.textContent = '';
        } else if (auth.isOwner()) {
            userLabel.textContent = `Signed in as ${user.displayName || user.email}`;
        } else {
            userLabel.textContent = `Signed in as ${user.displayName || user.email} (view only)`;
        }
    });
}
