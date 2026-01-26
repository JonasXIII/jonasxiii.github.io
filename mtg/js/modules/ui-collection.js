// ui-collection.js - Collection grid view

import * as state from './state.js';
import * as collection from './collection.js';
import { getCardImageUri, isMultiFaced } from './api.js';
import {
    renderCardTile, renderCardGrid, renderQuantityControl,
    renderFilterBar, renderManaCost, showModal, renderEmptyState, showToast
} from './ui-components.js';
import { openSearchModal } from './ui-search.js';

let _filters = {
    name: '',
    colors: [],
    type: 'all',
    set: 'all',
    rarity: 'all',
    colorMode: 'include'
};

let _sortBy = 'name';
let _sortDir = 'asc';

export function render() {
    renderSidebar();
    renderContent();
}

function renderSidebar() {
    const sidebar = document.getElementById('collection-sidebar');
    if (!sidebar) return;
    renderFilterBar(sidebar, _filters, (updatedFilters) => {
        _filters = updatedFilters;
        renderContent();
    });
}

function renderContent() {
    const content = document.getElementById('collection-content');
    if (!content) return;
    content.innerHTML = '';

    // Top bar
    const topbar = document.createElement('div');
    topbar.className = 'mtg-collection-topbar';

    // Sort dropdown
    const sortSelect = document.createElement('select');
    sortSelect.className = 'mtg-select';
    const sortOptions = [
        { value: 'name', label: 'Name' },
        { value: 'cmc', label: 'Mana Value' },
        { value: 'color', label: 'Color' },
        { value: 'rarity', label: 'Rarity' },
        { value: 'set', label: 'Set' },
        { value: 'price', label: 'Price' },
        { value: 'quantity', label: 'Quantity' }
    ];
    for (const opt of sortOptions) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = 'Sort: ' + opt.label;
        if (_sortBy === opt.value) o.selected = true;
        sortSelect.appendChild(o);
    }
    sortSelect.addEventListener('change', () => {
        _sortBy = sortSelect.value;
        renderContent();
    });
    topbar.appendChild(sortSelect);

    // Sort direction toggle
    const dirBtn = document.createElement('button');
    dirBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    dirBtn.textContent = _sortDir === 'asc' ? 'Asc' : 'Desc';
    dirBtn.addEventListener('click', () => {
        _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        dirBtn.textContent = _sortDir === 'asc' ? 'Asc' : 'Desc';
        renderContent();
    });
    topbar.appendChild(dirBtn);

    // Spacer
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    topbar.appendChild(spacer);

    // Add Cards button
    const addBtn = document.createElement('button');
    addBtn.className = 'mtg-btn mtg-btn-primary';
    addBtn.textContent = '+ Add Cards';
    addBtn.addEventListener('click', () => openSearchModal());
    topbar.appendChild(addBtn);

    content.appendChild(topbar);

    // Get data
    let entries = collection.getCollectionWithData();

    // Filter
    entries = collection.filterCollection(entries, _filters);

    // Sort
    entries = collection.sortCollection(entries, _sortBy, _sortDir);

    // Update stats
    const statsEl = document.getElementById('collection-stats');
    if (statsEl) {
        const stats = collection.getStats();
        statsEl.textContent = `${stats.uniqueCards} unique cards, ${stats.totalCards} total`;
    }

    // Empty state
    if (entries.length === 0) {
        const allEntries = collection.getCollectionWithData();
        if (allEntries.length === 0) {
            renderEmptyState(content, 'No cards yet', 'Search Scryfall to add cards to your collection.', '+ Add Cards', () => openSearchModal());
        } else {
            renderEmptyState(content, 'No matches', 'Try adjusting your filters.');
        }
        return;
    }

    // Render grid
    const grid = renderCardGrid(entries, 'collection-grid', {
        showSet: true,
        onCardClick: (scryfallId, cardData) => openCardDetail(scryfallId)
    });
    content.appendChild(grid);
}

function openCardDetail(scryfallId) {
    const entry = state.getCollection()[scryfallId];
    const cardData = state.getCardData(scryfallId);
    if (!entry || !cardData) return;

    showModal(cardData.name, (body) => {
        const detail = document.createElement('div');
        detail.className = 'mtg-card-detail';

        // Image
        const imageWrap = document.createElement('div');
        imageWrap.className = 'mtg-card-detail-image';
        const imgUri = getCardImageUri(cardData, 'large');
        if (imgUri) {
            const img = document.createElement('img');
            img.src = imgUri;
            img.alt = cardData.name;
            imageWrap.appendChild(img);

            // Flip button for multi-faced
            if (isMultiFaced(cardData)) {
                let faceIdx = 0;
                const flipBtn = document.createElement('button');
                flipBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
                flipBtn.textContent = 'Flip';
                flipBtn.style.marginTop = '8px';
                flipBtn.style.width = '100%';
                flipBtn.addEventListener('click', () => {
                    faceIdx = (faceIdx + 1) % cardData.card_faces.length;
                    const newUri = getCardImageUri(cardData, 'large', faceIdx);
                    if (newUri) img.src = newUri;
                });
                imageWrap.appendChild(flipBtn);
            }
        }
        detail.appendChild(imageWrap);

        // Info panel
        const info = document.createElement('div');
        info.className = 'mtg-card-detail-info';

        // Name + mana cost
        const nameRow = document.createElement('h3');
        nameRow.textContent = cardData.name + ' ';
        nameRow.appendChild(renderManaCost(cardData.mana_cost));
        info.appendChild(nameRow);

        // Type line
        const typeLine = document.createElement('p');
        typeLine.className = 'mtg-card-detail-type';
        typeLine.textContent = cardData.type_line;
        info.appendChild(typeLine);

        // Oracle text
        if (cardData.oracle_text) {
            const text = document.createElement('div');
            text.className = 'mtg-card-detail-text';
            text.textContent = cardData.oracle_text;
            info.appendChild(text);
        }

        // P/T or Loyalty
        if (cardData.power !== undefined && cardData.toughness !== undefined) {
            const pt = document.createElement('p');
            pt.innerHTML = `<strong>${cardData.power}/${cardData.toughness}</strong>`;
            info.appendChild(pt);
        } else if (cardData.loyalty) {
            const loy = document.createElement('p');
            loy.innerHTML = `<strong>Loyalty: ${cardData.loyalty}</strong>`;
            info.appendChild(loy);
        }

        // Meta
        const meta = document.createElement('dl');
        meta.className = 'mtg-card-detail-meta';
        const metaItems = [
            ['Set', `${cardData.set_name} (${cardData.set.toUpperCase()}) #${cardData.collector_number}`],
            ['Rarity', (cardData.rarity || '').charAt(0).toUpperCase() + (cardData.rarity || '').slice(1)],
            ['Price', cardData.prices?.usd ? `$${cardData.prices.usd}` : 'N/A']
        ];
        for (const [label, value] of metaItems) {
            const dt = document.createElement('dt');
            dt.textContent = label;
            const dd = document.createElement('dd');
            dd.textContent = value;
            meta.appendChild(dt);
            meta.appendChild(dd);
        }
        info.appendChild(meta);

        // Quantity control
        const qtyLabel = document.createElement('h4');
        qtyLabel.textContent = 'Owned Quantity';
        qtyLabel.style.margin = '16px 0 8px';
        info.appendChild(qtyLabel);

        const qtyControl = renderQuantityControl(entry.quantity, (newQty) => {
            collection.setQuantity(scryfallId, newQty);
            // Re-render the modal content
            openCardDetail(scryfallId);
            showToast(`Updated ${cardData.name} quantity to ${newQty}`, 'success');
        }, 0, 99);
        info.appendChild(qtyControl);

        // Allocation
        const allocation = state.getCardAllocation(scryfallId);
        if (allocation.decks.length > 0 || allocation.binders.length > 0) {
            const allocLabel = document.createElement('h4');
            allocLabel.textContent = 'Allocation';
            allocLabel.style.margin = '16px 0 8px';
            info.appendChild(allocLabel);

            const allocList = document.createElement('ul');
            allocList.className = 'mtg-allocation-list';

            for (const a of allocation.decks) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${a.deckName} (${a.board})</span><span>${a.quantity}x</span>`;
                allocList.appendChild(li);
            }
            for (const a of allocation.binders) {
                const li = document.createElement('li');
                li.innerHTML = `<span>${a.binderName}</span><span>${a.quantity}x</span>`;
                allocList.appendChild(li);
            }

            const unassigned = document.createElement('li');
            unassigned.innerHTML = `<span><strong>Unassigned</strong></span><span><strong>${allocation.unassigned}</strong></span>`;
            if (allocation.overAllocated) {
                unassigned.style.color = '#f56565';
                unassigned.innerHTML = `<span><strong>Over-allocated!</strong></span><span><strong>${allocation.total - allocation.assigned}</strong></span>`;
            }
            allocList.appendChild(unassigned);

            info.appendChild(allocList);
        }

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'mtg-btn mtg-btn-danger';
        removeBtn.textContent = 'Remove from Collection';
        removeBtn.style.marginTop = '16px';
        if (allocation.assigned > 0) {
            removeBtn.disabled = true;
            removeBtn.title = 'Remove from all decks/binders first';
        }
        removeBtn.addEventListener('click', () => {
            collection.removeCard(scryfallId);
            showToast(`Removed ${cardData.name} from collection`, 'info');
            const overlay = document.getElementById('modal-overlay');
            if (overlay) overlay.style.display = 'none';
        });
        info.appendChild(removeBtn);

        detail.appendChild(info);
        body.appendChild(detail);
    });
}

// Listen for state changes to re-render
state.subscribe((eventType) => {
    if (eventType === 'collection_changed' || eventType === 'init') {
        const tab = document.getElementById('tab-collection');
        if (tab && tab.classList.contains('active')) {
            renderContent();
        }
    }
});
