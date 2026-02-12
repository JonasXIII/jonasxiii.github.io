// ui-box-editor.js - Box editor view with simple card list

import * as state from './state.js';
import * as boxes from './boxes.js';
import * as collection from './collection.js';
import { getCardImageUri } from './api.js';
import {
    showModal, closeModal, showToast, renderEmptyState, renderManaCost,
    renderColorPicker
} from './ui-components.js';

let _selectedBoxId = null;
let _boxFilter = '';

export function render() {
    renderSidebar();
    renderContent();
}

function renderSidebar() {
    const sidebar = document.getElementById('boxes-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = 'Boxes';
    header.style.cssText = 'margin:0 0 12px;font-size:1.1em;';
    sidebar.appendChild(header);

    const allBoxes = boxes.getAll();

    const list = document.createElement('ul');
    list.className = 'mtg-deck-list';

    for (const box of allBoxes) {
        const li = document.createElement('li');
        li.className = 'mtg-deck-list-item' + (box.id === _selectedBoxId ? ' active' : '');
        li.addEventListener('click', () => {
            _selectedBoxId = box.id;
            _boxFilter = '';
            render();
        });

        if (box.color) {
            const colorDot = document.createElement('span');
            colorDot.className = 'mtg-deck-color-dot';
            colorDot.style.backgroundColor = box.color;
            li.appendChild(colorDot);
        }

        const name = document.createElement('span');
        name.textContent = box.name;
        name.style.flex = '1';
        li.appendChild(name);

        if (box.unlocked) {
            const unlockIcon = document.createElement('span');
            unlockIcon.className = 'mtg-unlock-icon';
            unlockIcon.textContent = '\u{1F513}';
            unlockIcon.title = 'Unlocked for quick-add';
            li.appendChild(unlockIcon);
        }

        const count = document.createElement('span');
        count.className = 'deck-card-count';
        count.textContent = boxes.getTotalCards(box.id);
        li.appendChild(count);

        list.appendChild(li);
    }
    sidebar.appendChild(list);

    const createBtn = document.createElement('button');
    createBtn.className = 'mtg-btn mtg-btn-primary';
    createBtn.textContent = '+ New Box';
    createBtn.style.cssText = 'width:100%;margin-top:12px;';
    createBtn.addEventListener('click', () => openCreateBoxModal());
    sidebar.appendChild(createBtn);
}

function renderContent() {
    const content = document.getElementById('boxes-content');
    if (!content) return;
    content.innerHTML = '';

    if (!_selectedBoxId) {
        renderEmptyState(content, 'Select a box', 'Choose a box from the sidebar or create a new one.');
        return;
    }

    const box = boxes.getById(_selectedBoxId);
    if (!box) {
        _selectedBoxId = null;
        renderEmptyState(content, 'Box not found', 'The selected box no longer exists.');
        return;
    }

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';

    const titleArea = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = box.name;
    title.style.cssText = 'margin:0 0 4px;cursor:pointer;';
    title.title = 'Click to rename';
    title.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'mtg-inline-input';
        input.value = box.name;
        input.style.fontSize = '1.3em';
        title.replaceWith(input);
        input.focus();
        input.select();
        const save = () => {
            if (input.value.trim()) {
                boxes.rename(_selectedBoxId, input.value.trim());
                render();
            }
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
    titleArea.appendChild(title);

    if (box.color) {
        const colorDot = document.createElement('span');
        colorDot.className = 'mtg-deck-color-dot';
        colorDot.style.backgroundColor = box.color;
        colorDot.style.width = '14px';
        colorDot.style.height = '14px';
        colorDot.style.marginLeft = '8px';
        title.appendChild(colorDot);
    }

    const meta = document.createElement('span');
    meta.style.cssText = 'font-size:0.85em;color:#888;';
    const totalCards = boxes.getTotalCards(_selectedBoxId);
    const uniqueCards = box.cards.length;
    meta.textContent = `${totalCards} cards (${uniqueCards} unique)`;
    titleArea.appendChild(meta);
    headerRow.appendChild(titleArea);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    // Lock/unlock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = box.unlocked ? 'mtg-btn-lock-unlocked' : 'mtg-btn-lock-locked';
    lockBtn.textContent = box.unlocked ? '\u{1F513} Unlocked' : '\u{1F512} Locked';
    lockBtn.title = box.unlocked ? 'Click to lock (removes from quick-add)' : 'Click to unlock (adds to quick-add)';
    lockBtn.addEventListener('click', () => {
        if (box.unlocked) {
            boxes.setUnlocked(_selectedBoxId, false);
            showToast(`Locked "${box.name}"`, 'info');
        } else {
            if (state.countUnlocked() >= state.MAX_UNLOCKED) {
                showToast(`Maximum ${state.MAX_UNLOCKED} unlocked collections. Lock another first.`, 'error');
                return;
            }
            boxes.setUnlocked(_selectedBoxId, true);
            showToast(`Unlocked "${box.name}" for quick-add`, 'success');
        }
        render();
    });
    actions.appendChild(lockBtn);

    // Color change button
    const colorBtn = document.createElement('button');
    colorBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    colorBtn.textContent = 'Color';
    colorBtn.addEventListener('click', () => {
        showModal('Box Color', (body) => {
            const picker = renderColorPicker(box.color, (newColor) => {
                boxes.setColor(_selectedBoxId, newColor);
                closeModal();
                render();
            });
            body.appendChild(picker);
        });
    });
    actions.appendChild(colorBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'mtg-btn mtg-btn-danger';
    deleteBtn.textContent = 'Delete Box';
    deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete "${box.name}"?`)) {
            boxes.remove(_selectedBoxId);
            _selectedBoxId = null;
            showToast('Box deleted', 'info');
            render();
        }
    });
    actions.appendChild(deleteBtn);
    headerRow.appendChild(actions);
    content.appendChild(headerRow);

    // Filter + Add card bar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;align-items:center;';

    const filterInput = document.createElement('input');
    filterInput.className = 'mtg-inline-input';
    filterInput.placeholder = 'Filter cards...';
    filterInput.value = _boxFilter;
    filterInput.style.cssText = 'flex:1;';
    filterInput.addEventListener('input', () => {
        _boxFilter = filterInput.value;
        renderCardList(content, box);
    });
    toolbar.appendChild(filterInput);

    const addBtn = document.createElement('button');
    addBtn.className = 'mtg-btn mtg-btn-primary mtg-btn-sm';
    addBtn.textContent = '+ Add Card';
    addBtn.addEventListener('click', () => openAddToBoxModal(_selectedBoxId));
    toolbar.appendChild(addBtn);

    content.appendChild(toolbar);

    // Card list container
    const listContainer = document.createElement('div');
    listContainer.id = 'box-card-list';
    content.appendChild(listContainer);

    renderCardList(content, box);
}

function renderCardList(content, box) {
    const listContainer = document.getElementById('box-card-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    let cards = boxes.getCardsWithData(_selectedBoxId);

    // Apply filter
    if (_boxFilter) {
        const filterLC = _boxFilter.toLowerCase();
        cards = cards.filter(c => {
            const name = (c.cardData?.name || '').toLowerCase();
            const type = (c.cardData?.type_line || '').toLowerCase();
            return name.includes(filterLC) || type.includes(filterLC);
        });
    }

    if (cards.length === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color:#aaa;text-align:center;padding:24px;';
        empty.textContent = box.cards.length === 0 ? 'No cards yet. Click "+ Add Card" to add some.' : 'No cards match your filter.';
        listContainer.appendChild(empty);
        return;
    }

    for (const card of cards) {
        const row = document.createElement('div');
        row.className = 'mtg-deck-card-row';

        // Card name
        const nameSpan = document.createElement('span');
        nameSpan.className = 'mtg-deck-card-name';
        nameSpan.textContent = card.cardData?.name || card.scryfall_id;
        nameSpan.style.cursor = 'pointer';
        nameSpan.addEventListener('click', () => {
            if (card.cardData) openCardPreviewModal(card);
        });
        row.appendChild(nameSpan);

        // Mana cost
        if (card.cardData?.mana_cost) {
            const mana = renderManaCost(card.cardData.mana_cost);
            mana.style.cssText = 'margin-left:8px;flex-shrink:0;';
            row.appendChild(mana);
        }

        // Type
        if (card.cardData?.type_line) {
            const typeSpan = document.createElement('span');
            typeSpan.style.cssText = 'font-size:0.8em;color:#888;margin-left:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;';
            typeSpan.textContent = card.cardData.type_line;
            row.appendChild(typeSpan);
        }

        // Set
        if (card.cardData?.set) {
            const setSpan = document.createElement('span');
            setSpan.style.cssText = 'font-size:0.8em;color:#888;margin-left:8px;text-transform:uppercase;';
            setSpan.textContent = card.cardData.set;
            row.appendChild(setSpan);
        }

        // Spacer
        const spacer = document.createElement('span');
        spacer.style.flex = '1';
        row.appendChild(spacer);

        // Quantity controls
        const qtyWrap = document.createElement('div');
        qtyWrap.style.cssText = 'display:flex;align-items:center;gap:4px;';

        const minusBtn = document.createElement('button');
        minusBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        minusBtn.textContent = '-';
        minusBtn.style.cssText = 'padding:2px 8px;min-width:auto;';
        minusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (card.quantity <= 1) {
                boxes.removeCard(_selectedBoxId, card.scryfall_id);
            } else {
                boxes.setCardQuantity(_selectedBoxId, card.scryfall_id, card.quantity - 1);
            }
            render();
        });
        qtyWrap.appendChild(minusBtn);

        const qtyLabel = document.createElement('span');
        qtyLabel.style.cssText = 'min-width:24px;text-align:center;font-weight:600;';
        qtyLabel.textContent = card.quantity;
        qtyWrap.appendChild(qtyLabel);

        const plusBtn = document.createElement('button');
        plusBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        plusBtn.textContent = '+';
        plusBtn.style.cssText = 'padding:2px 8px;min-width:auto;';
        plusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            boxes.setCardQuantity(_selectedBoxId, card.scryfall_id, card.quantity + 1);
            render();
        });
        qtyWrap.appendChild(plusBtn);

        row.appendChild(qtyWrap);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        removeBtn.textContent = '\u00d7';
        removeBtn.style.cssText = 'padding:2px 8px;min-width:auto;margin-left:8px;color:#f56565;';
        removeBtn.title = 'Remove card';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            boxes.removeCard(_selectedBoxId, card.scryfall_id);
            render();
        });
        row.appendChild(removeBtn);

        listContainer.appendChild(row);
    }
}

function openCardPreviewModal(card) {
    showModal(card.cardData?.name || 'Card', (body) => {
        const imgUri = getCardImageUri(card.cardData, 'normal');
        if (imgUri) {
            const img = document.createElement('img');
            img.src = imgUri;
            img.alt = card.cardData.name;
            img.style.cssText = 'width:250px;border-radius:10px;display:block;margin:0 auto;';
            body.appendChild(img);
        }
    });
}

function openCreateBoxModal() {
    showModal('New Box', (body) => {
        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const nameInput = document.createElement('input');
        nameInput.className = 'mtg-inline-input';
        nameInput.placeholder = 'Box Name';
        nameInput.autofocus = true;
        form.appendChild(nameInput);

        const descInput = document.createElement('input');
        descInput.className = 'mtg-inline-input';
        descInput.placeholder = 'Description (optional)';
        form.appendChild(descInput);

        // Color picker
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Box Color';
        colorLabel.style.cssText = 'font-size:0.9em;color:#666;display:block;';
        form.appendChild(colorLabel);

        let selectedColor = null;
        const colorPicker = renderColorPicker(null, (color) => {
            selectedColor = color;
        });
        form.appendChild(colorPicker);

        const createBtn = document.createElement('button');
        createBtn.className = 'mtg-btn mtg-btn-primary';
        createBtn.textContent = 'Create Box';
        createBtn.style.marginTop = '8px';
        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                showToast('Please enter a box name', 'error');
                return;
            }
            const id = boxes.create(name, descInput.value.trim(), selectedColor);
            _selectedBoxId = id;
            _boxFilter = '';
            closeModal();
            showToast(`Created box "${name}"`, 'success');
            render();
        });
        form.appendChild(createBtn);
        body.appendChild(form);

        setTimeout(() => nameInput.focus(), 100);
    });
}

function openAddToBoxModal(boxId) {
    showModal('Add Card to Box', (body) => {
        const searchInput = document.createElement('input');
        searchInput.className = 'mtg-inline-input';
        searchInput.placeholder = 'Filter collection by name...';
        searchInput.style.marginBottom = '12px';
        body.appendChild(searchInput);

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
                listContainer.innerHTML = '<p style="color:#aaa;text-align:center;">No matching cards.</p>';
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

                const setInfo = document.createElement('span');
                setInfo.style.cssText = 'font-size:0.8em;color:#888;';
                setInfo.textContent = (entry.cardData?.set || entry.set || '').toUpperCase();
                row.appendChild(setInfo);

                const avail = document.createElement('span');
                avail.style.cssText = 'font-size:0.8em;color:#888;min-width:60px;text-align:right;';
                avail.textContent = `${alloc.unassigned}/${alloc.total}`;
                if (alloc.unassigned <= 0) avail.style.color = '#f56565';
                row.appendChild(avail);

                row.addEventListener('click', () => {
                    boxes.addCard(boxId, entry.scryfallId, 1);
                    closeModal();
                    showToast(`Added ${entry.cardData?.name || 'card'} to box`, 'success');
                    render();
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
    if (eventType === 'boxes_changed' || eventType === 'init') {
        const tab = document.getElementById('tab-boxes');
        if (tab && tab.classList.contains('active')) {
            render();
        }
    }
});
