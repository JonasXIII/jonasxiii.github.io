// ui-deck-editor.js - Deck editor view

import * as state from './state.js';
import * as decks from './decks.js';
import * as collection from './collection.js';
import { compareByField } from './collection.js';
import { getCardImageUri } from './api.js';
import {
    renderManaCost, renderQuantityControl, showModal, closeModal,
    showToast, renderEmptyState, renderCardTile, renderColorPicker
} from './ui-components.js';

let _selectedDeckId = null;
let _deckViewMode = 'piles'; // 'grid' | 'piles'
let _deckGroupBy = 'type'; // 'type' | 'cmc' | 'color' | 'name'

export function render() {
    renderSidebar();
    renderContent();
    renderStats();
}

function renderSidebar() {
    const sidebar = document.getElementById('decks-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = 'Decks';
    header.style.cssText = 'margin:0 0 12px;font-size:1.1em;';
    sidebar.appendChild(header);

    const allDecks = decks.getAll();

    const list = document.createElement('ul');
    list.className = 'mtg-deck-list';

    for (const deck of allDecks) {
        const li = document.createElement('li');
        li.className = 'mtg-deck-list-item' + (deck.id === _selectedDeckId ? ' active' : '');
        li.addEventListener('click', () => {
            _selectedDeckId = deck.id;
            render();
        });

        if (deck.color) {
            const colorDot = document.createElement('span');
            colorDot.className = 'mtg-deck-color-dot';
            colorDot.style.backgroundColor = deck.color;
            li.appendChild(colorDot);
        }

        const name = document.createElement('span');
        name.textContent = deck.name;
        name.style.flex = '1';
        li.appendChild(name);

        if (deck.unlocked) {
            const unlockIcon = document.createElement('span');
            unlockIcon.className = 'mtg-unlock-icon';
            unlockIcon.textContent = '\u{1F513}';
            unlockIcon.title = 'Unlocked for quick-add';
            li.appendChild(unlockIcon);
        }

        const count = document.createElement('span');
        count.className = 'deck-card-count';
        count.textContent = decks.getTotalCards(deck.id);
        li.appendChild(count);

        list.appendChild(li);
    }
    sidebar.appendChild(list);

    // Create new deck button
    const createBtn = document.createElement('button');
    createBtn.className = 'mtg-btn mtg-btn-primary';
    createBtn.textContent = '+ New Deck';
    createBtn.style.cssText = 'width:100%;margin-top:12px;';
    createBtn.addEventListener('click', () => openCreateDeckModal());
    sidebar.appendChild(createBtn);
}

function renderContent() {
    const content = document.getElementById('decks-content');
    if (!content) return;
    content.innerHTML = '';

    if (!_selectedDeckId) {
        renderEmptyState(content, 'Select a deck', 'Choose a deck from the sidebar or create a new one.');
        return;
    }

    const deck = decks.getById(_selectedDeckId);
    if (!deck) {
        _selectedDeckId = null;
        renderEmptyState(content, 'Deck not found', 'The selected deck no longer exists.');
        return;
    }

    // Deck header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';

    const titleArea = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = deck.name;
    title.style.cssText = 'margin:0 0 4px;cursor:pointer;';
    title.title = 'Click to rename';
    title.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'mtg-inline-input';
        input.value = deck.name;
        input.style.fontSize = '1.3em';
        title.replaceWith(input);
        input.focus();
        input.select();
        const save = () => {
            if (input.value.trim()) {
                decks.rename(_selectedDeckId, input.value.trim());
                render();
            }
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
    titleArea.appendChild(title);

    if (deck.color) {
        const colorDot = document.createElement('span');
        colorDot.className = 'mtg-deck-color-dot';
        colorDot.style.backgroundColor = deck.color;
        colorDot.style.width = '14px';
        colorDot.style.height = '14px';
        colorDot.style.marginLeft = '8px';
        title.appendChild(colorDot);
    }

    if (deck.format) {
        const format = document.createElement('span');
        format.style.cssText = 'font-size:0.85em;color:#888;text-transform:uppercase;letter-spacing:0.5px;';
        format.textContent = deck.format;
        titleArea.appendChild(format);
    }
    headerRow.appendChild(titleArea);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    // Lock/unlock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = deck.unlocked ? 'mtg-btn-lock-unlocked' : 'mtg-btn-lock-locked';
    lockBtn.textContent = deck.unlocked ? '\u{1F513} Unlocked' : '\u{1F512} Locked';
    lockBtn.title = deck.unlocked ? 'Click to lock (removes from quick-add)' : 'Click to unlock (adds to quick-add)';
    lockBtn.addEventListener('click', () => {
        if (deck.unlocked) {
            decks.setUnlocked(_selectedDeckId, false);
            showToast(`Locked "${deck.name}"`, 'info');
        } else {
            if (state.countUnlocked() >= state.MAX_UNLOCKED) {
                showToast(`Maximum ${state.MAX_UNLOCKED} unlocked collections. Lock another first.`, 'error');
                return;
            }
            decks.setUnlocked(_selectedDeckId, true);
            showToast(`Unlocked "${deck.name}" for quick-add`, 'success');
        }
        render();
    });
    actions.appendChild(lockBtn);

    // Color change button
    const colorBtn = document.createElement('button');
    colorBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    colorBtn.textContent = 'Color';
    colorBtn.addEventListener('click', () => {
        showModal('Deck Color', (body) => {
            const picker = renderColorPicker(deck.color, (newColor) => {
                decks.setColor(_selectedDeckId, newColor);
                closeModal();
                render();
            });
            body.appendChild(picker);
        });
    });
    actions.appendChild(colorBtn);

    const addCardBtn = document.createElement('button');
    addCardBtn.className = 'mtg-btn mtg-btn-primary';
    addCardBtn.textContent = '+ Add Card';
    addCardBtn.addEventListener('click', () => openAddToDeckModal(_selectedDeckId));
    actions.appendChild(addCardBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'mtg-btn mtg-btn-danger';
    deleteBtn.textContent = 'Delete Deck';
    deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete "${deck.name}"?`)) {
            decks.remove(_selectedDeckId);
            _selectedDeckId = null;
            showToast('Deck deleted', 'info');
            render();
        }
    });
    actions.appendChild(deleteBtn);
    headerRow.appendChild(actions);
    content.appendChild(headerRow);

    // View controls
    const viewControls = document.createElement('div');
    viewControls.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;';

    for (const mode of ['piles', 'grid']) {
        const btn = document.createElement('button');
        btn.className = 'mtg-btn mtg-btn-sm ' + (_deckViewMode === mode ? 'mtg-btn-primary' : 'mtg-btn-secondary');
        btn.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
        btn.addEventListener('click', () => { _deckViewMode = mode; renderContent(); });
        viewControls.appendChild(btn);
    }

    const groupLabel = document.createElement('span');
    groupLabel.textContent = 'Group:';
    groupLabel.style.cssText = 'margin-left:12px;font-size:0.85em;color:#888;';
    viewControls.appendChild(groupLabel);

    const groupSelect = document.createElement('select');
    groupSelect.className = 'mtg-select';
    for (const opt of [
        { value: 'type', label: 'Type' },
        { value: 'cmc', label: 'Mana Value' },
        { value: 'color', label: 'Color' },
        { value: 'name', label: 'Name (A-Z)' },
        { value: 'custom', label: 'Custom Piles' }
    ]) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (_deckGroupBy === opt.value) o.selected = true;
        groupSelect.appendChild(o);
    }
    groupSelect.addEventListener('change', () => { _deckGroupBy = groupSelect.value; renderContent(); });
    viewControls.appendChild(groupSelect);

    content.appendChild(viewControls);

    // Card lists by board
    const boards = decks.getCardsByBoard(_selectedDeckId);

    for (const [boardName, cards] of Object.entries(boards)) {
        if (cards.length === 0 && boardName !== 'main') continue;

        const section = document.createElement('div');
        section.className = 'mtg-deck-section';

        const sectionHeader = document.createElement('h3');
        const totalInBoard = cards.reduce((s, c) => s + c.quantity, 0);
        sectionHeader.textContent = `${boardName.charAt(0).toUpperCase() + boardName.slice(1)} (${totalInBoard})`;
        section.appendChild(sectionHeader);

        // Make entire section a drop zone for board changes
        section.addEventListener('dragover', (e) => {
            e.preventDefault();
            section.classList.add('mtg-deck-section-drop-target');
        });
        section.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !section.contains(e.relatedTarget)) {
                section.classList.remove('mtg-deck-section-drop-target');
            }
        });
        section.addEventListener('drop', (e) => {
            e.preventDefault();
            section.classList.remove('mtg-deck-section-drop-target');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.fromBoard !== boardName) {
                    decks.removeCard(_selectedDeckId, data.scryfallId, data.fromBoard);
                    decks.addCard(_selectedDeckId, data.scryfallId, data.quantity, boardName);
                    showToast(`Moved to ${boardName}`, 'success');
                    render();
                }
            } catch (err) {}
        });

        if (cards.length === 0) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:#aaa;font-size:0.9em;font-style:italic;';
            empty.textContent = 'No cards yet. Click "+ Add Card" or drag cards here.';
            section.appendChild(empty);
        } else if (_deckGroupBy === 'custom') {
            renderCustomPileView(section, cards, boardName);
        } else if (_deckViewMode === 'piles') {
            renderPileView(section, cards, boardName);
        } else {
            renderGridView(section, cards, boardName);
        }

        content.appendChild(section);
    }
}

// --- Deck Tile Factory ---

function createDeckTile(card, boardName) {
    const tile = document.createElement('div');
    tile.className = 'mtg-card-tile';
    tile.dataset.scryfallId = card.scryfall_id;

    // Foil detection
    if (card.scryfall_id.includes(':foil')) {
        tile.classList.add('mtg-card-foil');
    }

    const imgUri = getCardImageUri(card.cardData, 'normal');
    if (imgUri) {
        const img = document.createElement('img');
        img.src = imgUri;
        img.alt = card.cardData?.name || 'Card';
        img.loading = 'lazy';
        img.draggable = false; // prevent native image drag
        tile.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.className = 'mtg-card-placeholder';
        ph.textContent = card.cardData?.name || card.scryfall_id;
        tile.appendChild(ph);
    }

    // Quantity badge
    if (card.quantity > 1) {
        const badge = document.createElement('div');
        badge.className = 'mtg-deck-qty-badge';
        badge.textContent = card.quantity + 'x';
        tile.appendChild(badge);
    }

    // Over-allocation warning
    const alloc = state.getCardAllocation(card.scryfall_id);
    if (alloc.overAllocated) {
        tile.style.boxShadow = '0 0 0 3px #f56565';
    }

    // Hover overlay with +/- buttons
    const overlay = document.createElement('div');
    overlay.className = 'mtg-card-overlay';

    const plusBtn = document.createElement('button');
    plusBtn.className = 'mtg-card-add-btn';
    plusBtn.textContent = '+';
    plusBtn.title = 'Add one more';
    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        decks.setCardQuantity(_selectedDeckId, card.scryfall_id, card.quantity + 1, boardName);
        render();
    });
    overlay.appendChild(plusBtn);

    const minusBtn = document.createElement('button');
    minusBtn.className = 'mtg-card-menu-btn';
    minusBtn.textContent = '\u2212';
    minusBtn.title = card.quantity === 1 ? 'Remove from deck' : 'Remove one';
    minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        decks.setCardQuantity(_selectedDeckId, card.scryfall_id, card.quantity - 1, boardName);
        render();
    });
    overlay.appendChild(minusBtn);

    tile.appendChild(overlay);

    // Drag support
    tile.draggable = true;
    tile._dragHandler = (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            scryfallId: card.scryfall_id,
            fromBoard: boardName,
            quantity: card.quantity
        }));
        e.dataTransfer.effectAllowed = 'move';
        tile.classList.add('mtg-pile-dragging');
    };
    tile.addEventListener('dragstart', tile._dragHandler);
    tile.addEventListener('dragend', () => {
        tile.classList.remove('mtg-pile-dragging');
        document.querySelectorAll('.mtg-pile-drag-over').forEach(el => el.classList.remove('mtg-pile-drag-over'));
    });

    return tile;
}

// --- Grid View ---

function renderGridView(container, cards, boardName) {
    // Sort cards
    const sorted = sortCards([...cards], _deckGroupBy);
    const cardGrid = document.createElement('div');
    cardGrid.className = 'mtg-card-grid';

    for (const card of sorted) {
        const tile = createDeckTile(card, boardName);
        cardGrid.appendChild(tile);
    }
    container.appendChild(cardGrid);
}

// --- Pile View ---

function renderPileView(container, cards, boardName) {
    const groups = groupCards(cards, _deckGroupBy);
    const pileContainer = document.createElement('div');
    pileContainer.className = 'mtg-pile-container';

    for (const [groupName, groupCards] of Object.entries(groups)) {
        if (groupCards.length === 0) continue;

        const pile = document.createElement('div');
        pile.className = 'mtg-pile';

        const header = document.createElement('div');
        header.className = 'mtg-pile-header';
        const totalQty = groupCards.reduce((s, c) => s + c.quantity, 0);
        header.textContent = `${groupName} (${totalQty})`;
        pile.appendChild(header);

        const stack = document.createElement('div');
        stack.className = 'mtg-pile-stack';

        // Sort within group by name as tiebreaker
        groupCards.sort((a, b) => compareByField(a, b, 'name'));

        for (const card of groupCards) {
            const tile = createDeckTile(card, boardName);
            tile.classList.add('mtg-pile-card');
            stack.appendChild(tile);
        }

        pile.appendChild(stack);
        pileContainer.appendChild(pile);
    }

    container.appendChild(pileContainer);
}

// --- Custom Pile View ---

function renderCustomPileView(container, cards, boardName) {
    const deck = decks.getById(_selectedDeckId);
    const piles = deck?.custom_piles || [];
    const sortMode = deck?.custom_pile_sort || 'name';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'mtg-custom-pile-toolbar';

    const addPileBtn = document.createElement('button');
    addPileBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    addPileBtn.textContent = '+ New Pile';
    addPileBtn.addEventListener('click', () => {
        showModal('New Pile', (body) => {
            const input = document.createElement('input');
            input.className = 'mtg-inline-input';
            input.placeholder = 'Pile name...';
            input.autofocus = true;
            body.appendChild(input);

            const createBtn = document.createElement('button');
            createBtn.className = 'mtg-btn mtg-btn-primary';
            createBtn.textContent = 'Create';
            createBtn.style.marginTop = '12px';
            createBtn.addEventListener('click', () => {
                const name = input.value.trim();
                if (!name) { showToast('Enter a pile name', 'error'); return; }
                decks.addCustomPile(_selectedDeckId, name);
                closeModal();
                render();
            });
            body.appendChild(createBtn);
            setTimeout(() => input.focus(), 100);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') createBtn.click(); });
        });
    });
    toolbar.appendChild(addPileBtn);

    const sortLabel = document.createElement('span');
    sortLabel.textContent = 'Within piles:';
    sortLabel.style.cssText = 'font-size:0.85em;color:#888;margin-left:8px;';
    toolbar.appendChild(sortLabel);

    const sortSelect = document.createElement('select');
    sortSelect.className = 'mtg-select';
    for (const opt of [
        { value: 'manual', label: 'Manual Order' },
        { value: 'name', label: 'Sort by Name' },
        { value: 'cmc', label: 'Sort by CMC' },
        { value: 'color', label: 'Sort by Color' }
    ]) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (sortMode === opt.value) o.selected = true;
        sortSelect.appendChild(o);
    }
    sortSelect.addEventListener('change', () => {
        decks.setCustomPileSort(_selectedDeckId, sortSelect.value);
        render();
    });
    toolbar.appendChild(sortSelect);

    container.appendChild(toolbar);

    // Group cards by custom_pile
    const groups = {};
    for (const pile of piles) {
        groups[pile.id] = { name: pile.name, cards: [] };
    }
    groups['__uncategorized'] = { name: 'Uncategorized', cards: [] };

    for (const card of cards) {
        const pileId = card.custom_pile || '__uncategorized';
        if (groups[pileId]) {
            groups[pileId].cards.push(card);
        } else {
            groups['__uncategorized'].cards.push(card);
        }
    }

    // Sort within each pile
    for (const group of Object.values(groups)) {
        if (sortMode === 'manual') {
            group.cards.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));
        } else {
            group.cards.sort((a, b) => compareByField(a, b, sortMode));
        }
    }

    // Render piles in order: defined piles, then uncategorized
    const pileContainer = document.createElement('div');
    pileContainer.className = 'mtg-pile-container';

    const renderOrder = [...piles.map(p => p.id), '__uncategorized'];
    for (const pileId of renderOrder) {
        const group = groups[pileId];
        if (!group) continue;

        const pile = document.createElement('div');
        pile.className = 'mtg-pile';
        pile.dataset.pileId = pileId;

        // Header
        const header = document.createElement('div');
        header.className = 'mtg-pile-header mtg-pile-header-custom';

        const totalQty = group.cards.reduce((s, c) => s + c.quantity, 0);

        if (pileId === '__uncategorized') {
            header.textContent = `Uncategorized (${totalQty})`;
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.textContent = group.name;
            nameSpan.style.cursor = 'pointer';
            nameSpan.title = 'Click to rename';
            nameSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.className = 'mtg-inline-input mtg-pile-rename-input';
                input.value = group.name;
                nameSpan.replaceWith(input);
                input.focus();
                input.select();
                const save = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        decks.renameCustomPile(_selectedDeckId, pileId, newName);
                    }
                    render();
                };
                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') save(); });
            });
            header.appendChild(nameSpan);

            const countSpan = document.createElement('span');
            countSpan.style.cssText = 'margin-left:4px;color:#888;';
            countSpan.textContent = `(${totalQty})`;
            header.appendChild(countSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'mtg-pile-delete-btn';
            deleteBtn.textContent = '\u00d7';
            deleteBtn.title = 'Delete pile';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                decks.removeCustomPile(_selectedDeckId, pileId);
                showToast(`Deleted pile "${group.name}"`, 'info');
                render();
            });
            header.appendChild(deleteBtn);
        }

        pile.appendChild(header);

        // Make pile a drop target for cross-pile card drag
        pile.addEventListener('dragover', (e) => {
            e.preventDefault();
            pile.classList.add('mtg-pile-drag-over');
        });
        pile.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !pile.contains(e.relatedTarget)) {
                pile.classList.remove('mtg-pile-drag-over');
            }
        });
        pile.addEventListener('drop', (e) => {
            e.preventDefault();
            pile.classList.remove('mtg-pile-drag-over');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.fromBoard === boardName) {
                    const targetPileId = pileId === '__uncategorized' ? null : pileId;
                    if (data.fromPileId !== targetPileId) {
                        decks.setCardCustomPile(_selectedDeckId, data.scryfallId, boardName, targetPileId);
                        showToast(`Moved to ${group.name}`, 'success');
                        render();
                    } else if (sortMode === 'manual' && data.dropIndex !== undefined) {
                        decks.reorderCardInPile(_selectedDeckId, data.scryfallId, boardName, data.dropIndex);
                        render();
                    }
                } else {
                    // Cross-board move
                    decks.removeCard(_selectedDeckId, data.scryfallId, data.fromBoard);
                    decks.addCard(_selectedDeckId, data.scryfallId, data.quantity, boardName);
                    const targetPileId = pileId === '__uncategorized' ? null : pileId;
                    decks.setCardCustomPile(_selectedDeckId, data.scryfallId, boardName, targetPileId);
                    showToast(`Moved to ${boardName} - ${group.name}`, 'success');
                    render();
                }
            } catch (err) {}
        });

        // Card stack
        const stack = document.createElement('div');
        stack.className = 'mtg-pile-stack';

        for (let cardIdx = 0; cardIdx < group.cards.length; cardIdx++) {
            const card = group.cards[cardIdx];

            // Drop indicator (for manual reorder within pile)
            if (sortMode === 'manual') {
                const indicator = document.createElement('div');
                indicator.className = 'mtg-pile-drop-indicator';
                indicator.dataset.dropIndex = cardIdx;
                stack.appendChild(indicator);
            }

            const tile = createDeckTile(card, boardName);
            tile.classList.add('mtg-pile-card');

            // Enhanced dragstart with pile info
            tile.removeEventListener('dragstart', tile._dragHandler);
            const currentPileId = pileId === '__uncategorized' ? null : pileId;
            tile._dragHandler = (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    scryfallId: card.scryfall_id,
                    fromBoard: boardName,
                    quantity: card.quantity,
                    fromPileId: currentPileId
                }));
                e.dataTransfer.effectAllowed = 'move';
                tile.classList.add('mtg-pile-dragging');
                if (sortMode === 'manual') {
                    stack.classList.add('mtg-pile-dragging-active');
                }
            };
            tile.addEventListener('dragstart', tile._dragHandler);
            tile.addEventListener('dragend', () => {
                tile.classList.remove('mtg-pile-dragging');
                stack.classList.remove('mtg-pile-dragging-active');
                document.querySelectorAll('.mtg-pile-drop-indicator-active').forEach(el => el.classList.remove('mtg-pile-drop-indicator-active'));
                document.querySelectorAll('.mtg-pile-drag-over').forEach(el => el.classList.remove('mtg-pile-drag-over'));
            });

            stack.appendChild(tile);
        }

        // Final drop indicator at end
        if (sortMode === 'manual') {
            const finalIndicator = document.createElement('div');
            finalIndicator.className = 'mtg-pile-drop-indicator';
            finalIndicator.dataset.dropIndex = group.cards.length;
            stack.appendChild(finalIndicator);

            // Handle within-pile reorder via indicators
            stack.addEventListener('dragover', (e) => {
                e.preventDefault();
                const indicators = stack.querySelectorAll('.mtg-pile-drop-indicator');
                let closestIndicator = null;
                let closestDist = Infinity;
                for (const ind of indicators) {
                    const rect = ind.getBoundingClientRect();
                    const dist = Math.abs(e.clientY - (rect.top + rect.height / 2));
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestIndicator = ind;
                    }
                }
                indicators.forEach(ind => ind.classList.remove('mtg-pile-drop-indicator-active'));
                if (closestIndicator) closestIndicator.classList.add('mtg-pile-drop-indicator-active');
            });

            stack.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const activeIndicator = stack.querySelector('.mtg-pile-drop-indicator-active');
                if (!activeIndicator) return;
                const dropIndex = parseInt(activeIndicator.dataset.dropIndex);
                try {
                    const data = JSON.parse(e.dataTransfer.getData('application/json'));
                    if (data.fromBoard === boardName) {
                        const targetPileId = pileId === '__uncategorized' ? null : pileId;
                        if (data.fromPileId !== targetPileId) {
                            decks.setCardCustomPile(_selectedDeckId, data.scryfallId, boardName, targetPileId);
                        }
                        decks.reorderCardInPile(_selectedDeckId, data.scryfallId, boardName, dropIndex);
                        render();
                    }
                } catch (err) {}
            });
        }

        pile.appendChild(stack);
        pileContainer.appendChild(pile);
    }

    container.appendChild(pileContainer);
}

// --- Card Grouping ---

function groupCards(cards, groupBy) {
    switch (groupBy) {
        case 'type': return groupByType(cards);
        case 'cmc': return groupByCmc(cards);
        case 'color': return groupByColor(cards);
        default: return { 'All Cards': [...cards] };
    }
}

function groupByType(cards) {
    const groups = {};
    const typeOrder = ['Creatures', 'Instants', 'Sorceries', 'Enchantments', 'Artifacts', 'Planeswalkers', 'Lands', 'Other'];
    for (const t of typeOrder) groups[t] = [];

    for (const card of cards) {
        const type = (card.cardData?.type_line || '').toLowerCase();
        if (type.includes('creature')) groups['Creatures'].push(card);
        else if (type.includes('instant')) groups['Instants'].push(card);
        else if (type.includes('sorcery')) groups['Sorceries'].push(card);
        else if (type.includes('enchantment')) groups['Enchantments'].push(card);
        else if (type.includes('artifact')) groups['Artifacts'].push(card);
        else if (type.includes('planeswalker')) groups['Planeswalkers'].push(card);
        else if (type.includes('land')) groups['Lands'].push(card);
        else groups['Other'].push(card);
    }
    return groups;
}

function groupByCmc(cards) {
    const groups = {};
    for (let i = 0; i <= 7; i++) groups[i === 7 ? '7+' : String(i)] = [];
    for (const card of cards) {
        const cmc = Math.min(Math.floor(card.cardData?.cmc || 0), 7);
        const key = cmc === 7 ? '7+' : String(cmc);
        groups[key].push(card);
    }
    return groups;
}

function groupByColor(cards) {
    const groups = { 'White': [], 'Blue': [], 'Black': [], 'Red': [], 'Green': [], 'Multi': [], 'Colorless': [] };
    for (const card of cards) {
        const colors = card.cardData?.colors || [];
        if (colors.length === 0) groups['Colorless'].push(card);
        else if (colors.length > 1) groups['Multi'].push(card);
        else {
            const map = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
            groups[map[colors[0]] || 'Colorless'].push(card);
        }
    }
    return groups;
}

function sortCards(cards, sortBy) {
    return cards.sort((a, b) => {
        const cmp = compareByField(a, b, sortBy);
        return cmp !== 0 ? cmp : compareByField(a, b, 'name');
    });
}

function renderStats() {
    const statsPanel = document.getElementById('decks-stats');
    if (!statsPanel) return;
    statsPanel.innerHTML = '';

    if (!_selectedDeckId) return;

    const stats = decks.getDeckStats(_selectedDeckId);
    if (!stats) return;

    // Card count
    const countCard = document.createElement('div');
    countCard.className = 'mtg-stats-card';
    const countH4 = document.createElement('h4');
    countH4.textContent = 'Card Count';
    countCard.appendChild(countH4);
    const countP = document.createElement('p');
    countP.style.cssText = 'font-size:1.8em;font-weight:700;color:#667eea;margin:0;';
    countP.textContent = stats.totalCards;
    countCard.appendChild(countP);
    const landP = document.createElement('p');
    landP.style.cssText = 'font-size:0.85em;color:#888;margin:4px 0 0;';
    landP.textContent = `${stats.landCount} lands, ${stats.totalCards - stats.landCount} nonlands`;
    countCard.appendChild(landP);
    statsPanel.appendChild(countCard);

    // Mana Curve
    const curveCard = document.createElement('div');
    curveCard.className = 'mtg-stats-card';
    const curveH4 = document.createElement('h4');
    curveH4.textContent = 'Mana Curve';
    curveCard.appendChild(curveH4);

    const curveWrap = document.createElement('div');
    curveWrap.className = 'mtg-mana-curve';
    curveWrap.style.marginBottom = '24px';

    const maxCount = Math.max(1, ...Object.values(stats.manaCurve));
    for (let cmc = 0; cmc <= 7; cmc++) {
        const count = stats.manaCurve[cmc] || 0;
        const bar = document.createElement('div');
        bar.className = 'mtg-mana-curve-bar';
        bar.style.height = (count / maxCount * 100) + '%';

        const label = document.createElement('span');
        label.className = 'bar-label';
        label.textContent = cmc === 7 ? '7+' : String(cmc);
        bar.appendChild(label);

        if (count > 0) {
            const countLabel = document.createElement('span');
            countLabel.className = 'bar-count';
            countLabel.textContent = count;
            bar.appendChild(countLabel);
        }

        curveWrap.appendChild(bar);
    }
    curveCard.appendChild(curveWrap);
    statsPanel.appendChild(curveCard);

    // Color Distribution
    const colorCard = document.createElement('div');
    colorCard.className = 'mtg-stats-card';
    const colorH4 = document.createElement('h4');
    colorH4.textContent = 'Colors';
    colorCard.appendChild(colorH4);

    const colorWrap = document.createElement('div');
    colorWrap.className = 'mtg-color-dist';

    const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
    const colorColors = { W: '#f9faf4', U: '#c1d7e9', B: '#bab1ab', R: '#f9aa8f', G: '#9bd3ae', C: '#ccc2c0' };

    for (const [color, count] of Object.entries(stats.colorDist).sort((a, b) => b[1] - a[1])) {
        const item = document.createElement('div');
        item.className = 'mtg-color-dist-item';

        const dot = document.createElement('span');
        dot.className = 'mtg-color-dot';
        dot.style.backgroundColor = colorColors[color] || '#ccc';
        dot.style.border = '1px solid #999';
        item.appendChild(dot);

        const label = document.createElement('span');
        label.textContent = `${colorNames[color] || color}: ${count}`;
        item.appendChild(label);

        colorWrap.appendChild(item);
    }
    colorCard.appendChild(colorWrap);
    statsPanel.appendChild(colorCard);
}

function openCreateDeckModal() {
    showModal('New Deck', (body) => {
        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const nameInput = document.createElement('input');
        nameInput.className = 'mtg-inline-input';
        nameInput.placeholder = 'Deck Name';
        nameInput.autofocus = true;
        form.appendChild(nameInput);

        const formatSelect = document.createElement('select');
        formatSelect.className = 'mtg-select';
        formatSelect.style.width = '100%';
        const formats = ['', 'standard', 'modern', 'legacy', 'vintage', 'commander', 'pauper', 'pioneer', 'historic'];
        for (const f of formats) {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f ? f.charAt(0).toUpperCase() + f.slice(1) : 'No format';
            formatSelect.appendChild(opt);
        }
        form.appendChild(formatSelect);

        const descInput = document.createElement('input');
        descInput.className = 'mtg-inline-input';
        descInput.placeholder = 'Description (optional)';
        form.appendChild(descInput);

        // Color picker
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Deck Color';
        colorLabel.style.cssText = 'font-size:0.9em;color:#666;display:block;';
        form.appendChild(colorLabel);

        let selectedColor = null;
        const colorPicker = renderColorPicker(null, (color) => {
            selectedColor = color;
        });
        form.appendChild(colorPicker);

        const createBtn = document.createElement('button');
        createBtn.className = 'mtg-btn mtg-btn-primary';
        createBtn.textContent = 'Create Deck';
        createBtn.style.marginTop = '8px';
        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                showToast('Please enter a deck name', 'error');
                return;
            }
            const id = decks.create(name, formatSelect.value, descInput.value.trim(), selectedColor);
            _selectedDeckId = id;
            closeModal();
            showToast(`Created deck "${name}"`, 'success');
            render();
        });
        form.appendChild(createBtn);
        body.appendChild(form);

        setTimeout(() => nameInput.focus(), 100);
    });
}

function openAddToDeckModal(deckId) {
    showModal('Add Card to Deck', (body) => {
        const searchInput = document.createElement('input');
        searchInput.className = 'mtg-inline-input';
        searchInput.placeholder = 'Filter collection by name...';
        searchInput.style.marginBottom = '12px';
        body.appendChild(searchInput);

        const boardSelect = document.createElement('select');
        boardSelect.className = 'mtg-select';
        boardSelect.style.cssText = 'margin-bottom:12px;width:100%;';
        for (const b of ['main', 'sideboard', 'maybe']) {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b.charAt(0).toUpperCase() + b.slice(1);
            boardSelect.appendChild(opt);
        }
        body.appendChild(boardSelect);

        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'max-height:400px;overflow-y:auto;';
        body.appendChild(listContainer);

        const renderList = () => {
            listContainer.innerHTML = '';
            let entries = collection.getCollectionWithData();

            const filter = searchInput.value.trim().toLowerCase();
            if (filter) {
                entries = entries.filter(e => {
                    const name = (e.cardData?.name || e.name || '').toLowerCase();
                    return name.includes(filter);
                });
            }

            entries.sort((a, b) => {
                const nameA = a.cardData?.name || a.name || '';
                const nameB = b.cardData?.name || b.name || '';
                return nameA.localeCompare(nameB);
            });

            if (entries.length === 0) {
                listContainer.innerHTML = '<p style="color:#aaa;text-align:center;">No matching cards in collection.</p>';
                return;
            }

            for (const entry of entries) {
                const row = document.createElement('div');
                row.className = 'mtg-deck-card-row';
                row.style.cursor = 'pointer';

                const alloc = state.getCardAllocation(entry.scryfallId);

                const name = document.createElement('span');
                name.className = 'mtg-deck-card-name';
                name.textContent = entry.cardData?.name || entry.name;
                row.appendChild(name);

                const mana = document.createElement('span');
                mana.className = 'mtg-deck-card-mana';
                if (entry.cardData?.mana_cost) {
                    mana.appendChild(renderManaCost(entry.cardData.mana_cost));
                }
                row.appendChild(mana);

                const avail = document.createElement('span');
                avail.style.cssText = 'font-size:0.8em;color:#888;min-width:60px;text-align:right;';
                avail.textContent = `${alloc.unassigned}/${alloc.total} avail`;
                if (alloc.unassigned <= 0) {
                    avail.style.color = '#f56565';
                }
                row.appendChild(avail);

                row.addEventListener('click', () => {
                    decks.addCard(deckId, entry.scryfallId, 1, boardSelect.value);
                    showToast(`Added ${entry.cardData?.name || 'card'} to ${boardSelect.value}`, 'success');
                    render();
                    renderList(); // Refresh available counts
                });

                listContainer.appendChild(row);
            }
        };

        searchInput.addEventListener('input', renderList);
        renderList();

        setTimeout(() => searchInput.focus(), 100);
    });
}

// Listen for state changes
state.subscribe((eventType) => {
    if (eventType === 'decks_changed' || eventType === 'init') {
        const tab = document.getElementById('tab-decks');
        if (tab && tab.classList.contains('active')) {
            render();
        }
    }
});
