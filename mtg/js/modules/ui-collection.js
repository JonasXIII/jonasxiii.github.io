// ui-collection.js - Collection grid view

import * as state from './state.js';
import * as collection from './collection.js';
import * as decks from './decks.js';
import * as binders from './binders.js';
import { getCardImageUri, isMultiFaced } from './api.js';
import {
    renderCardTile, renderCardGrid, renderQuantityControl,
    renderFilterBar, renderManaCost, showModal, closeModal, renderEmptyState, showToast
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

let _sortCriteria = [{ field: 'name' }];
let _sortDir = 'asc';
let _availabilityFilter = 'all'; // 'all' | 'unassigned' | 'not-in-decks' | 'not-in-locked' | 'in-binders' | 'in-trade-binders'

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

    // Multi-level sort builder
    const sortBuilder = renderSortBuilder(_sortCriteria, _sortDir, (newCriteria) => {
        _sortCriteria = newCriteria;
        renderContent();
    }, (newDir) => {
        _sortDir = newDir;
        renderContent();
    });
    topbar.appendChild(sortBuilder);

    // Availability filter dropdown
    const availSelect = document.createElement('select');
    availSelect.className = 'mtg-select';
    const availOptions = [
        { value: 'all', label: 'Show All' },
        { value: 'unassigned', label: 'Unassigned Only' },
        { value: 'not-in-decks', label: 'Not in Decks' },
        { value: 'not-in-locked', label: 'Not in Locked' },
        { value: 'in-binders', label: 'In Binders' },
        { value: 'in-trade-binders', label: 'In Trade Binders' }
    ];
    for (const opt of availOptions) {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (_availabilityFilter === opt.value) o.selected = true;
        availSelect.appendChild(o);
    }
    availSelect.addEventListener('change', () => {
        _availabilityFilter = availSelect.value;
        renderContent();
    });
    topbar.appendChild(availSelect);

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
    entries = collection.sortCollection(entries, _sortCriteria, _sortDir);

    // Availability filter
    if (_availabilityFilter !== 'all') {
        entries = entries.map(e => {
            const alloc = state.getCardAllocation(e.scryfallId);
            switch (_availabilityFilter) {
                case 'unassigned': {
                    // Only show copies not in any deck or binder
                    return { ...e, quantity: Math.max(0, alloc.unassigned) };
                }
                case 'not-in-decks': {
                    // Subtract all deck allocations, keep binder ones
                    const deckUsed = alloc.decks.reduce((s, a) => s + a.quantity, 0);
                    return { ...e, quantity: Math.max(0, e.quantity - deckUsed) };
                }
                case 'not-in-locked': {
                    // Only subtract allocations from locked decks/binders
                    let lockedUsed = 0;
                    for (const a of alloc.decks) {
                        const deck = state.getDeckById(a.deckId);
                        if (deck && !deck.unlocked) lockedUsed += a.quantity;
                    }
                    for (const a of alloc.binders) {
                        const binder = state.getBinderById(a.binderId);
                        if (binder && !binder.unlocked) lockedUsed += a.quantity;
                    }
                    return { ...e, quantity: Math.max(0, e.quantity - lockedUsed) };
                }
                case 'in-binders': {
                    // Only show cards that are in at least one binder, show binder qty
                    const binderQty = alloc.binders.reduce((s, a) => s + a.quantity, 0);
                    return { ...e, quantity: binderQty };
                }
                case 'in-trade-binders': {
                    let tradeQty = 0;
                    for (const a of alloc.binders) {
                        const binder = state.getBinderById(a.binderId);
                        if (binder && binder.trade) tradeQty += a.quantity;
                    }
                    return { ...e, quantity: tradeQty };
                }
                default:
                    return e;
            }
        }).filter(e => e.quantity > 0);
    }

    // Compute filtered stats and update header
    const filteredStats = collection.getFilteredStats(entries);
    const statsEl = document.getElementById('collection-stats');
    if (statsEl) {
        statsEl.textContent = `${filteredStats.uniqueCards} unique, ${filteredStats.totalCards} total`;
    }

    // Empty state
    if (entries.length === 0) {
        const allEntries = collection.getCollectionWithData();
        if (allEntries.length === 0) {
            renderEmptyState(content, 'No cards yet', 'Search Scryfall to add cards to the collection.', '+ Add Cards', () => openSearchModal());
        } else {
            renderEmptyState(content, 'No matches', 'Try adjusting the filters.');
        }
        return;
    }

    // Stats bar
    const statsBar = renderStatsBar(filteredStats);
    content.appendChild(statsBar);

    // Build allocation map for performance
    const allocationMap = buildAllocationMap();

    // Render grid
    const grid = renderCardGrid(entries, 'collection-grid', {
        showSet: true,
        onCardClick: (scryfallId, cardData) => openCardDetail(scryfallId),
        showOverlay: true,
        onQuickAdd: (scryfallId, cardData, triggerEl) => openRadialMenu(scryfallId, cardData, triggerEl),
        onContextMenu: (scryfallId, cardData, triggerEl) => openContextMenu(scryfallId, cardData, triggerEl),
        allocationMap
    });
    content.appendChild(grid);
}

function renderStatsBar(stats) {
    const bar = document.createElement('div');
    bar.className = 'mtg-collection-stats-bar';

    // --- Price ---
    const priceSection = document.createElement('div');
    priceSection.className = 'mtg-stats-section';
    const priceLabel = document.createElement('div');
    priceLabel.className = 'mtg-stats-section-label';
    priceLabel.textContent = 'Total Value';
    const priceValue = document.createElement('div');
    priceValue.className = 'mtg-stats-section-value mtg-stats-price';
    priceValue.textContent = '$' + stats.totalPrice.toFixed(2);
    priceSection.appendChild(priceLabel);
    priceSection.appendChild(priceValue);
    bar.appendChild(priceSection);

    // --- Mana Curve ---
    const curveSection = document.createElement('div');
    curveSection.className = 'mtg-stats-section mtg-stats-section-wide';
    const curveLabel = document.createElement('div');
    curveLabel.className = 'mtg-stats-section-label';
    curveLabel.textContent = 'Mana Curve';
    curveSection.appendChild(curveLabel);

    const curveChart = document.createElement('div');
    curveChart.className = 'mtg-stats-curve';
    const maxCurve = Math.max(...Object.values(stats.manaCurve), 1);
    for (let i = 0; i <= 7; i++) {
        const count = stats.manaCurve[i] || 0;
        const col = document.createElement('div');
        col.className = 'mtg-stats-curve-col';

        const barEl = document.createElement('div');
        barEl.className = 'mtg-stats-curve-bar';
        barEl.style.height = Math.max((count / maxCurve) * 100, 2) + '%';
        if (count > 0) {
            const countLabel = document.createElement('span');
            countLabel.className = 'mtg-stats-curve-count';
            countLabel.textContent = count;
            barEl.appendChild(countLabel);
        }
        col.appendChild(barEl);

        const label = document.createElement('div');
        label.className = 'mtg-stats-curve-label';
        label.textContent = i === 7 ? '7+' : String(i);
        col.appendChild(label);

        curveChart.appendChild(col);
    }
    curveSection.appendChild(curveChart);
    bar.appendChild(curveSection);

    // --- Color Distribution ---
    const colorSection = document.createElement('div');
    colorSection.className = 'mtg-stats-section';
    const colorLabel = document.createElement('div');
    colorLabel.className = 'mtg-stats-section-label';
    colorLabel.textContent = 'Colors';
    colorSection.appendChild(colorLabel);

    const colorList = document.createElement('div');
    colorList.className = 'mtg-stats-colors';
    const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
    const colorOrder = ['W', 'U', 'B', 'R', 'G', 'C'];
    for (const c of colorOrder) {
        const count = stats.colorDist[c];
        if (!count) continue;
        const item = document.createElement('div');
        item.className = 'mtg-stats-color-item';
        const dot = document.createElement('span');
        dot.className = 'mtg-color-dot mtg-mana-' + c;
        item.appendChild(dot);
        const text = document.createElement('span');
        text.textContent = count;
        item.appendChild(text);
        colorList.appendChild(item);
    }
    colorSection.appendChild(colorList);
    bar.appendChild(colorSection);

    // --- Rarity Distribution ---
    const raritySection = document.createElement('div');
    raritySection.className = 'mtg-stats-section';
    const rarityLabel = document.createElement('div');
    rarityLabel.className = 'mtg-stats-section-label';
    rarityLabel.textContent = 'Rarity';
    raritySection.appendChild(rarityLabel);

    const rarityList = document.createElement('div');
    rarityList.className = 'mtg-stats-rarities';
    const rarityOrder = ['mythic', 'rare', 'uncommon', 'common'];
    const rarityColors = { mythic: '#f56565', rare: '#ecc94b', uncommon: '#a0aec0', common: '#2d3748' };
    const rarityLabels = { mythic: 'M', rare: 'R', uncommon: 'U', common: 'C' };
    for (const r of rarityOrder) {
        const count = stats.rarityDist[r];
        if (!count) continue;
        const item = document.createElement('div');
        item.className = 'mtg-stats-rarity-item';
        const badge = document.createElement('span');
        badge.className = 'mtg-stats-rarity-badge';
        badge.style.background = rarityColors[r];
        badge.textContent = rarityLabels[r];
        item.appendChild(badge);
        const text = document.createElement('span');
        text.textContent = count;
        item.appendChild(text);
        rarityList.appendChild(item);
    }
    raritySection.appendChild(rarityList);
    bar.appendChild(raritySection);

    // --- Type Distribution ---
    const typeSection = document.createElement('div');
    typeSection.className = 'mtg-stats-section';
    const typeLabel = document.createElement('div');
    typeLabel.className = 'mtg-stats-section-label';
    typeLabel.textContent = 'Types';
    typeSection.appendChild(typeLabel);

    const typeList = document.createElement('div');
    typeList.className = 'mtg-stats-types';
    const typeOrder = ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land'];
    for (const t of typeOrder) {
        const count = stats.typeDist[t];
        if (!count) continue;
        const item = document.createElement('div');
        item.className = 'mtg-stats-type-item';
        item.textContent = t.charAt(0).toUpperCase() + t.slice(1) + ' ' + count;
        typeList.appendChild(item);
    }
    typeSection.appendChild(typeList);
    bar.appendChild(typeSection);

    return bar;
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

// --- Allocation Map (precomputed for performance) ---

function buildAllocationMap() {
    const map = {};
    for (const deck of state.getDecks()) {
        for (const card of deck.cards) {
            if (!map[card.scryfall_id]) map[card.scryfall_id] = [];
            map[card.scryfall_id].push({ type: 'deck', id: deck.id, name: deck.name, color: deck.color, quantity: card.quantity });
        }
    }
    for (const binder of state.getBinders()) {
        for (const card of binder.cards) {
            if (!map[card.scryfall_id]) map[card.scryfall_id] = [];
            map[card.scryfall_id].push({ type: 'binder', id: binder.id, name: binder.name, color: binder.color, quantity: card.quantity });
        }
    }
    return map;
}

// --- Radial Quick-Add Menu ---

function openRadialMenu(scryfallId, cardData, triggerEl) {
    // Remove any existing menus
    document.querySelectorAll('.mtg-radial-menu').forEach(m => m.remove());
    document.querySelectorAll('.mtg-context-menu').forEach(m => m.remove());

    const unlocked = state.getUnlockedCollections();
    const menu = document.createElement('div');
    menu.className = 'mtg-radial-menu';

    if (unlocked.length === 0) {
        const msg = document.createElement('div');
        msg.className = 'mtg-radial-empty';
        msg.textContent = 'No unlocked collections. Unlock a deck or binder first.';
        menu.appendChild(msg);
    } else {
        const radius = 60;
        const count = Math.min(unlocked.length, state.MAX_UNLOCKED);
        const angleStep = (2 * Math.PI) / Math.max(count, 1);
        const startAngle = -Math.PI / 2;

        for (let i = 0; i < count; i++) {
            const col = unlocked[i];
            const angle = startAngle + i * angleStep;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            const isDeck = col.id.startsWith('deck-');
            const isInThis = isDeck
                ? state.getDeckById(col.id)?.cards.some(c => c.scryfall_id === scryfallId)
                : state.getBinderById(col.id)?.cards.some(c => c.scryfall_id === scryfallId);

            const slot = document.createElement('button');
            slot.className = 'mtg-radial-slot' + (isInThis ? ' mtg-radial-slot-active' : '');
            slot.style.backgroundColor = col.color || '#667eea';
            slot.style.left = x + 'px';
            slot.style.top = y + 'px';
            slot.title = col.name;

            const initial = document.createElement('span');
            initial.textContent = isInThis ? '\u2713' : col.name.charAt(0).toUpperCase();
            slot.appendChild(initial);

            const tooltip = document.createElement('div');
            tooltip.className = 'mtg-radial-tooltip';
            tooltip.textContent = col.name + (isInThis ? ' (remove)' : '');
            slot.appendChild(tooltip);

            slot.addEventListener('click', (e) => {
                e.stopPropagation();

                if (isInThis) {
                    // Remove from this collection
                    if (isDeck) {
                        decks.removeCard(col.id, scryfallId, 'main');
                    } else {
                        const binderData = binders.getById(col.id);
                        if (binderData) {
                            const cardEntry = binderData.cards.find(c => c.scryfall_id === scryfallId);
                            if (cardEntry) binders.removeCard(col.id, cardEntry.position);
                        }
                    }
                    showToast(`Removed ${cardData?.name || 'card'} from ${col.name}`, 'info');
                } else {
                    // Remove from all other unlocked collections first
                    for (const otherCol of unlocked) {
                        if (otherCol.id === col.id) continue;
                        const isOtherDeck = otherCol.id.startsWith('deck-');
                        if (isOtherDeck) {
                            const otherDeck = state.getDeckById(otherCol.id);
                            if (otherDeck?.cards.some(c => c.scryfall_id === scryfallId)) {
                                decks.removeCard(otherCol.id, scryfallId, 'main');
                            }
                        } else {
                            const otherBinder = state.getBinderById(otherCol.id);
                            if (otherBinder) {
                                const cardEntry = otherBinder.cards.find(c => c.scryfall_id === scryfallId);
                                if (cardEntry) binders.removeCard(otherCol.id, cardEntry.position);
                            }
                        }
                    }
                    // Add to this collection
                    if (isDeck) {
                        decks.addCard(col.id, scryfallId, 1, 'main');
                    } else {
                        const binderData = binders.getById(col.id);
                        if (binderData) {
                            const grid = binders.getBinderGrid(col.id);
                            const emptySlot = grid.findIndex(s => s === null);
                            if (emptySlot >= 0) {
                                binders.addCard(col.id, scryfallId, 1, emptySlot);
                            } else {
                                showToast('No empty slots in this binder', 'error');
                                menu.remove();
                                return;
                            }
                        }
                    }
                    showToast(`Added ${cardData?.name || 'card'} to ${col.name}`, 'success');
                }
                menu.remove();
            });

            menu.appendChild(slot);
        }
    }

    // Position relative to trigger element
    const rect = triggerEl.getBoundingClientRect();
    menu.style.left = (rect.left + rect.width / 2) + 'px';
    menu.style.top = (rect.top + rect.height / 2) + 'px';

    document.body.appendChild(menu);

    // Close on click outside
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// --- Context Menu (Hamburger) ---

function openContextMenu(scryfallId, cardData, triggerEl) {
    // Remove any existing menus
    document.querySelectorAll('.mtg-context-menu').forEach(m => m.remove());
    document.querySelectorAll('.mtg-radial-menu').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'mtg-context-menu';

    // View Details
    const viewItem = document.createElement('button');
    viewItem.className = 'mtg-context-menu-item';
    viewItem.innerHTML = '<span class="mtg-context-menu-icon">\u{1F50D}</span> View Details';
    viewItem.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        openCardDetail(scryfallId);
    });
    menu.appendChild(viewItem);

    // Show Allocation
    const allocItem = document.createElement('button');
    allocItem.className = 'mtg-context-menu-item';
    allocItem.innerHTML = '<span class="mtg-context-menu-icon">\u{1F4CA}</span> Show Allocation';
    allocItem.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        openAllocationModal(scryfallId, cardData);
    });
    menu.appendChild(allocItem);

    // Quantity control
    const entry = state.getCollection()[scryfallId];
    if (entry) {
        const qtyItem = document.createElement('div');
        qtyItem.className = 'mtg-context-menu-item mtg-context-menu-qty';

        const label = document.createElement('span');
        label.textContent = 'Quantity';
        qtyItem.appendChild(label);

        const qtyControl = renderQuantityControl(entry.quantity, (newQty) => {
            collection.setQuantity(scryfallId, newQty);
            showToast(`Updated quantity to ${newQty}`, 'success');
            menu.remove();
        }, 0, 99);
        qtyItem.appendChild(qtyControl);

        menu.appendChild(qtyItem);
    }

    // Position below trigger
    const rect = triggerEl.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';

    // Keep menu on screen
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
        menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';
    }
    if (menuRect.bottom > window.innerHeight) {
        menu.style.top = (rect.top - menuRect.height - 4) + 'px';
    }

    // Close on click outside
    const closeHandler = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeHandler);
        }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

// --- Allocation Modal ---

function openAllocationModal(scryfallId, cardData) {
    const allocation = state.getCardAllocation(scryfallId);
    showModal(`${cardData?.name || 'Card'} - Allocation`, (body) => {
        if (allocation.decks.length === 0 && allocation.binders.length === 0) {
            const empty = document.createElement('p');
            empty.style.cssText = 'color:#aaa;text-align:center;';
            empty.textContent = 'This card is not in any decks or binders.';
            body.appendChild(empty);
        } else {
            const list = document.createElement('ul');
            list.className = 'mtg-allocation-list';

            for (const a of allocation.decks) {
                const li = document.createElement('li');
                const deck = state.getDeckById(a.deckId);
                if (deck && deck.color) {
                    const dot = document.createElement('span');
                    dot.className = 'mtg-deck-color-dot';
                    dot.style.backgroundColor = deck.color;
                    li.appendChild(dot);
                }
                const text = document.createElement('span');
                text.textContent = `${a.deckName} (${a.board})`;
                li.appendChild(text);
                const qty = document.createElement('span');
                qty.textContent = `${a.quantity}x`;
                li.appendChild(qty);
                list.appendChild(li);
            }

            for (const a of allocation.binders) {
                const li = document.createElement('li');
                const binder = state.getBinderById(a.binderId);
                if (binder && binder.color) {
                    const dot = document.createElement('span');
                    dot.className = 'mtg-deck-color-dot';
                    dot.style.backgroundColor = binder.color;
                    li.appendChild(dot);
                }
                const text = document.createElement('span');
                text.textContent = a.binderName;
                li.appendChild(text);
                const qty = document.createElement('span');
                qty.textContent = `${a.quantity}x`;
                li.appendChild(qty);
                list.appendChild(li);
            }

            body.appendChild(list);
        }

        const summary = document.createElement('p');
        summary.style.cssText = 'margin-top:12px;font-size:0.9em;color:#666;';
        summary.textContent = `${allocation.assigned} of ${allocation.total} copies assigned, ${allocation.unassigned} unassigned`;
        if (allocation.overAllocated) {
            summary.style.color = '#f56565';
            summary.textContent = `Over-allocated! ${allocation.assigned} assigned but only ${allocation.total} owned.`;
        }
        body.appendChild(summary);
    });
}

// --- Sort Builder UI ---

const SORT_FIELDS = [
    { value: 'name', label: 'Name' },
    { value: 'cmc', label: 'Mana Value' },
    { value: 'color', label: 'Color' },
    { value: 'rarity', label: 'Rarity' },
    { value: 'set', label: 'Set' },
    { value: 'price', label: 'Price' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'type', label: 'Type' }
];

function renderSortBuilder(criteria, direction, onCriteriaChange, onDirectionChange) {
    const wrap = document.createElement('div');
    wrap.className = 'mtg-sort-builder';

    for (let i = 0; i < criteria.length; i++) {
        if (i > 0) {
            const thenLabel = document.createElement('span');
            thenLabel.className = 'mtg-sort-then';
            thenLabel.textContent = 'then';
            wrap.appendChild(thenLabel);
        }

        const select = document.createElement('select');
        select.className = 'mtg-select';
        const usedFields = criteria.map((c, idx) => idx !== i ? c.field : null).filter(Boolean);
        for (const f of SORT_FIELDS) {
            if (usedFields.includes(f.value)) continue;
            const o = document.createElement('option');
            o.value = f.value;
            o.textContent = (i === 0 ? 'Sort: ' : '') + f.label;
            if (criteria[i].field === f.value) o.selected = true;
            select.appendChild(o);
        }
        const idx = i;
        select.addEventListener('change', () => {
            const newCriteria = [...criteria];
            newCriteria[idx] = { field: select.value };
            onCriteriaChange(newCriteria);
        });
        wrap.appendChild(select);

        if (i > 0) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm mtg-sort-remove';
            removeBtn.textContent = '\u00d7';
            removeBtn.title = 'Remove sort level';
            const removeIdx = i;
            removeBtn.addEventListener('click', () => {
                onCriteriaChange(criteria.filter((_, j) => j !== removeIdx));
            });
            wrap.appendChild(removeBtn);
        }
    }

    if (criteria.length < 3) {
        const addBtn = document.createElement('button');
        addBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        addBtn.textContent = '+ Sort';
        addBtn.title = 'Add sort level';
        addBtn.addEventListener('click', () => {
            const usedFields = criteria.map(c => c.field);
            const nextField = SORT_FIELDS.find(f => !usedFields.includes(f.value));
            if (nextField) {
                onCriteriaChange([...criteria, { field: nextField.value }]);
            }
        });
        wrap.appendChild(addBtn);
    }

    const dirBtn = document.createElement('button');
    dirBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    dirBtn.textContent = direction === 'asc' ? 'Asc' : 'Desc';
    dirBtn.addEventListener('click', () => {
        onDirectionChange(direction === 'asc' ? 'desc' : 'asc');
    });
    wrap.appendChild(dirBtn);

    return wrap;
}

// Listen for state changes to re-render
state.subscribe((eventType) => {
    if (eventType === 'collection_changed' || eventType === 'init' || eventType === 'decks_changed' || eventType === 'binders_changed') {
        const tab = document.getElementById('tab-collection');
        if (tab && tab.classList.contains('active')) {
            renderContent();
        }
    }
});
