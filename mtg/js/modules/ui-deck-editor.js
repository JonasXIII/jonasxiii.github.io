// ui-deck-editor.js - Deck editor view

import * as state from './state.js';
import * as decks from './decks.js';
import * as collection from './collection.js';
import { getCardImageUri } from './api.js';
import {
    renderManaCost, renderQuantityControl, showModal, closeModal,
    showToast, renderEmptyState, renderCardTile
} from './ui-components.js';

let _selectedDeckId = null;

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

        const name = document.createElement('span');
        name.textContent = deck.name;
        li.appendChild(name);

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

    if (deck.format) {
        const format = document.createElement('span');
        format.style.cssText = 'font-size:0.85em;color:#888;text-transform:uppercase;letter-spacing:0.5px;';
        format.textContent = deck.format;
        titleArea.appendChild(format);
    }
    headerRow.appendChild(titleArea);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;';

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

        if (cards.length === 0) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:#aaa;font-size:0.9em;font-style:italic;';
            empty.textContent = 'No cards yet. Click "+ Add Card" to get started.';
            section.appendChild(empty);
        }

        for (const card of cards) {
            const row = document.createElement('div');
            row.className = 'mtg-deck-card-row';

            // Quantity
            const qty = document.createElement('span');
            qty.className = 'mtg-deck-card-qty';
            qty.textContent = card.quantity + 'x';
            row.appendChild(qty);

            // Name
            const name = document.createElement('span');
            name.className = 'mtg-deck-card-name';
            name.textContent = card.cardData?.name || card.scryfall_id;

            // Allocation warning
            const alloc = state.getCardAllocation(card.scryfall_id);
            if (alloc.overAllocated) {
                name.style.color = '#f56565';
                name.title = `Over-allocated! Own ${alloc.total}, assigned ${alloc.assigned}`;
            }
            row.appendChild(name);

            // Mana cost
            const mana = document.createElement('span');
            mana.className = 'mtg-deck-card-mana';
            if (card.cardData?.mana_cost) {
                mana.appendChild(renderManaCost(card.cardData.mana_cost));
            }
            row.appendChild(mana);

            // Actions
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'mtg-deck-card-actions';

            const plusBtn = document.createElement('button');
            plusBtn.textContent = '+';
            plusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                decks.setCardQuantity(_selectedDeckId, card.scryfall_id, card.quantity + 1, boardName);
                render();
            });
            actionsDiv.appendChild(plusBtn);

            const minusBtn = document.createElement('button');
            minusBtn.textContent = '-';
            minusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                decks.setCardQuantity(_selectedDeckId, card.scryfall_id, card.quantity - 1, boardName);
                render();
            });
            actionsDiv.appendChild(minusBtn);

            row.appendChild(actionsDiv);
            section.appendChild(row);
        }

        content.appendChild(section);
    }
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
            const id = decks.create(name, formatSelect.value, descInput.value.trim());
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
