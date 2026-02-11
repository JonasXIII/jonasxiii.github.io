// ui-binder-editor.js - Binder editor view with page grid

import * as state from './state.js';
import * as binders from './binders.js';
import * as collection from './collection.js';
import { getCardImageUri } from './api.js';
import {
    showModal, closeModal, showToast, renderEmptyState, renderManaCost,
    renderColorPicker
} from './ui-components.js';

let _selectedBinderId = null;
let _currentPage = 0;

export function render() {
    renderSidebar();
    renderContent();
}

function renderSidebar() {
    const sidebar = document.getElementById('binders-sidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    const header = document.createElement('h3');
    header.textContent = 'Binders';
    header.style.cssText = 'margin:0 0 12px;font-size:1.1em;';
    sidebar.appendChild(header);

    const allBinders = binders.getAll();

    const list = document.createElement('ul');
    list.className = 'mtg-deck-list';

    for (const binder of allBinders) {
        const li = document.createElement('li');
        li.className = 'mtg-deck-list-item' + (binder.id === _selectedBinderId ? ' active' : '');
        li.addEventListener('click', () => {
            _selectedBinderId = binder.id;
            _currentPage = 0;
            render();
        });

        if (binder.color) {
            const colorDot = document.createElement('span');
            colorDot.className = 'mtg-deck-color-dot';
            colorDot.style.backgroundColor = binder.color;
            li.appendChild(colorDot);
        }

        const name = document.createElement('span');
        name.textContent = binder.name;
        name.style.flex = '1';
        li.appendChild(name);

        if (binder.trade) {
            const tradeIcon = document.createElement('span');
            tradeIcon.className = 'mtg-trade-icon';
            tradeIcon.textContent = '\u{1F4B0}';
            tradeIcon.title = 'Trade binder';
            li.appendChild(tradeIcon);
        }

        if (binder.unlocked) {
            const unlockIcon = document.createElement('span');
            unlockIcon.className = 'mtg-unlock-icon';
            unlockIcon.textContent = '\u{1F513}';
            unlockIcon.title = 'Unlocked for quick-add';
            li.appendChild(unlockIcon);
        }

        const count = document.createElement('span');
        count.className = 'deck-card-count';
        count.textContent = binders.getTotalCards(binder.id);
        li.appendChild(count);

        list.appendChild(li);
    }
    sidebar.appendChild(list);

    // Create button
    const createBtn = document.createElement('button');
    createBtn.className = 'mtg-btn mtg-btn-primary';
    createBtn.textContent = '+ New Binder';
    createBtn.style.cssText = 'width:100%;margin-top:12px;';
    createBtn.addEventListener('click', () => openCreateBinderModal());
    sidebar.appendChild(createBtn);
}

function renderContent() {
    const content = document.getElementById('binders-content');
    if (!content) return;
    content.innerHTML = '';

    if (!_selectedBinderId) {
        renderEmptyState(content, 'Select a binder', 'Choose a binder from the sidebar or create a new one.');
        return;
    }

    const binder = binders.getById(_selectedBinderId);
    if (!binder) {
        _selectedBinderId = null;
        renderEmptyState(content, 'Binder not found', 'The selected binder no longer exists.');
        return;
    }

    // Header
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';

    const titleArea = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = binder.name;
    title.style.cssText = 'margin:0 0 4px;cursor:pointer;';
    title.title = 'Click to rename';
    title.addEventListener('click', () => {
        const input = document.createElement('input');
        input.className = 'mtg-inline-input';
        input.value = binder.name;
        input.style.fontSize = '1.3em';
        title.replaceWith(input);
        input.focus();
        input.select();
        const save = () => {
            if (input.value.trim()) {
                binders.rename(_selectedBinderId, input.value.trim());
                render();
            }
        };
        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
    titleArea.appendChild(title);

    if (binder.color) {
        const colorDot = document.createElement('span');
        colorDot.className = 'mtg-deck-color-dot';
        colorDot.style.backgroundColor = binder.color;
        colorDot.style.width = '14px';
        colorDot.style.height = '14px';
        colorDot.style.marginLeft = '8px';
        title.appendChild(colorDot);
    }

    const meta = document.createElement('span');
    meta.style.cssText = 'font-size:0.85em;color:#888;';
    meta.textContent = `${binder.pages} pages, ${binder.slots_per_page} slots per page`;
    titleArea.appendChild(meta);
    headerRow.appendChild(titleArea);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';

    // Lock/unlock toggle
    const lockBtn = document.createElement('button');
    lockBtn.className = binder.unlocked ? 'mtg-btn-lock-unlocked' : 'mtg-btn-lock-locked';
    lockBtn.textContent = binder.unlocked ? '\u{1F513} Unlocked' : '\u{1F512} Locked';
    lockBtn.title = binder.unlocked ? 'Click to lock (removes from quick-add)' : 'Click to unlock (adds to quick-add)';
    lockBtn.addEventListener('click', () => {
        if (binder.unlocked) {
            binders.setUnlocked(_selectedBinderId, false);
            showToast(`Locked "${binder.name}"`, 'info');
        } else {
            if (state.countUnlocked() >= state.MAX_UNLOCKED) {
                showToast(`Maximum ${state.MAX_UNLOCKED} unlocked collections. Lock another first.`, 'error');
                return;
            }
            binders.setUnlocked(_selectedBinderId, true);
            showToast(`Unlocked "${binder.name}" for quick-add`, 'success');
        }
        render();
    });
    actions.appendChild(lockBtn);

    // Trade toggle
    const tradeBtn = document.createElement('button');
    tradeBtn.className = binder.trade ? 'mtg-btn-trade-active' : 'mtg-btn-trade-inactive';
    tradeBtn.textContent = binder.trade ? '\u{1F4B0} Trade' : '\u{1F4B0} Not Trade';
    tradeBtn.title = binder.trade ? 'Click to unmark as trade binder' : 'Click to mark as trade binder';
    tradeBtn.addEventListener('click', () => {
        binders.setTrade(_selectedBinderId, !binder.trade);
        showToast(binder.trade ? `"${binder.name}" unmarked as trade binder` : `"${binder.name}" marked as trade binder`, 'info');
        render();
    });
    actions.appendChild(tradeBtn);

    // Color change button
    const colorBtn = document.createElement('button');
    colorBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    colorBtn.textContent = 'Color';
    colorBtn.addEventListener('click', () => {
        showModal('Binder Color', (body) => {
            const picker = renderColorPicker(binder.color, (newColor) => {
                binders.setColor(_selectedBinderId, newColor);
                closeModal();
                render();
            });
            body.appendChild(picker);
        });
    });
    actions.appendChild(colorBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'mtg-btn mtg-btn-danger';
    deleteBtn.textContent = 'Delete Binder';
    deleteBtn.addEventListener('click', () => {
        if (confirm(`Delete "${binder.name}"?`)) {
            binders.remove(_selectedBinderId);
            _selectedBinderId = null;
            showToast('Binder deleted', 'info');
            render();
        }
    });
    actions.appendChild(deleteBtn);
    headerRow.appendChild(actions);
    content.appendChild(headerRow);

    // Page grid
    const pageData = binders.getBinderPage(_selectedBinderId, _currentPage);
    // Use known layout presets, fallback to sqrt calculation
    const layoutMap = { 9: 3, 12: 4, 16: 4 };
    const cols = layoutMap[binder.slots_per_page] || Math.round(Math.sqrt(binder.slots_per_page));
    const rows = Math.ceil(binder.slots_per_page / cols);

    const grid = document.createElement('div');
    grid.className = 'mtg-binder-page';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.maxWidth = (cols * 160 + (cols - 1) * 8) + 'px';

    for (let i = 0; i < binder.slots_per_page; i++) {
        const slotData = pageData[i];
        const absolutePosition = _currentPage * binder.slots_per_page + i;

        const slot = document.createElement('div');
        slot.className = 'mtg-binder-slot' + (slotData ? ' filled' : '');

        // Make all slots drop targets
        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            slot.classList.add('mtg-binder-slot-drop-target');
        });
        slot.addEventListener('dragleave', () => {
            slot.classList.remove('mtg-binder-slot-drop-target');
        });
        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('mtg-binder-slot-drop-target');
            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.binderId === _selectedBinderId && data.fromPosition !== absolutePosition) {
                    binders.moveCard(_selectedBinderId, data.fromPosition, absolutePosition);
                    showToast('Card moved', 'success');
                    render();
                }
            } catch (err) {}
        });

        if (slotData && slotData.cardData) {
            // Make filled slots draggable
            slot.draggable = true;
            slot.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({
                    binderId: _selectedBinderId,
                    fromPosition: absolutePosition,
                    scryfallId: slotData.scryfall_id
                }));
                e.dataTransfer.effectAllowed = 'move';
                slot.classList.add('mtg-binder-slot-dragging');
            });
            slot.addEventListener('dragend', () => {
                slot.classList.remove('mtg-binder-slot-dragging');
            });

            const imgUri = getCardImageUri(slotData.cardData, 'normal');
            if (imgUri) {
                const img = document.createElement('img');
                img.src = imgUri;
                img.alt = slotData.cardData.name;
                img.loading = 'lazy';
                img.draggable = false;
                slot.appendChild(img);
            }

            // Click to view/remove
            slot.addEventListener('click', () => {
                openSlotActionModal(binder.id, absolutePosition, slotData);
            });
        } else {
            // Empty slot
            const addIcon = document.createElement('span');
            addIcon.className = 'slot-add-icon';
            addIcon.textContent = '+';
            slot.appendChild(addIcon);

            slot.addEventListener('click', () => {
                openAddToSlotModal(binder.id, absolutePosition);
            });
        }

        grid.appendChild(slot);
    }
    content.appendChild(grid);

    // Page navigation
    const nav = document.createElement('div');
    nav.className = 'mtg-binder-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    prevBtn.textContent = 'Previous';
    prevBtn.disabled = _currentPage <= 0;
    prevBtn.addEventListener('click', () => {
        if (_currentPage > 0) {
            _currentPage--;
            renderContent();
        }
    });
    nav.appendChild(prevBtn);

    const pageLabel = document.createElement('span');
    pageLabel.textContent = `Page ${_currentPage + 1} of ${binder.pages}`;
    nav.appendChild(pageLabel);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = _currentPage >= binder.pages - 1;
    nextBtn.addEventListener('click', () => {
        if (_currentPage < binder.pages - 1) {
            _currentPage++;
            renderContent();
        }
    });
    nav.appendChild(nextBtn);

    content.appendChild(nav);
}

function openCreateBinderModal() {
    showModal('New Binder', (body) => {
        const form = document.createElement('div');
        form.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const nameInput = document.createElement('input');
        nameInput.className = 'mtg-inline-input';
        nameInput.placeholder = 'Binder Name';
        nameInput.autofocus = true;
        form.appendChild(nameInput);

        const descInput = document.createElement('input');
        descInput.className = 'mtg-inline-input';
        descInput.placeholder = 'Description (optional)';
        form.appendChild(descInput);

        // Pages
        const pagesLabel = document.createElement('label');
        pagesLabel.textContent = 'Pages';
        pagesLabel.style.cssText = 'display:flex;flex-direction:column;font-size:0.9em;color:#666;';
        const pagesInput = document.createElement('input');
        pagesInput.className = 'mtg-inline-input';
        pagesInput.type = 'number';
        pagesInput.min = '1';
        pagesInput.max = '100';
        pagesInput.value = '9';
        pagesLabel.appendChild(pagesInput);
        form.appendChild(pagesLabel);

        // Layout presets
        const layoutLabel = document.createElement('label');
        layoutLabel.textContent = 'Page Layout';
        layoutLabel.style.cssText = 'font-size:0.9em;color:#666;display:block;';
        form.appendChild(layoutLabel);

        const layoutPresets = [
            { label: '3 x 3', cols: 3, rows: 3, slots: 9 },
            { label: '4 x 3', cols: 4, rows: 3, slots: 12 },
            { label: '4 x 4', cols: 4, rows: 4, slots: 16 },
        ];
        let selectedLayout = layoutPresets[0];

        const layoutWrap = document.createElement('div');
        layoutWrap.className = 'mtg-layout-presets';

        for (const preset of layoutPresets) {
            const presetBtn = document.createElement('button');
            presetBtn.type = 'button';
            presetBtn.className = 'mtg-layout-preset-btn' + (preset === selectedLayout ? ' active' : '');

            const preview = document.createElement('div');
            preview.className = 'mtg-layout-preview';
            preview.style.gridTemplateColumns = `repeat(${preset.cols}, 1fr)`;
            for (let i = 0; i < preset.slots; i++) {
                const dot = document.createElement('div');
                dot.className = 'mtg-layout-preview-slot';
                preview.appendChild(dot);
            }
            presetBtn.appendChild(preview);

            const labelSpan = document.createElement('span');
            labelSpan.textContent = `${preset.label} (${preset.slots})`;
            presetBtn.appendChild(labelSpan);

            presetBtn.addEventListener('click', () => {
                selectedLayout = preset;
                layoutWrap.querySelectorAll('.mtg-layout-preset-btn').forEach(b => b.classList.remove('active'));
                presetBtn.classList.add('active');
            });

            layoutWrap.appendChild(presetBtn);
        }
        form.appendChild(layoutWrap);

        // Color picker
        const colorLabel = document.createElement('label');
        colorLabel.textContent = 'Binder Color';
        colorLabel.style.cssText = 'font-size:0.9em;color:#666;display:block;';
        form.appendChild(colorLabel);

        let selectedColor = null;
        const colorPicker = renderColorPicker(null, (color) => {
            selectedColor = color;
        });
        form.appendChild(colorPicker);

        const createBtn = document.createElement('button');
        createBtn.className = 'mtg-btn mtg-btn-primary';
        createBtn.textContent = 'Create Binder';
        createBtn.style.marginTop = '8px';
        createBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) {
                showToast('Please enter a binder name', 'error');
                return;
            }
            const id = binders.create(
                name,
                descInput.value.trim(),
                parseInt(pagesInput.value) || 9,
                selectedLayout.slots,
                selectedColor
            );
            _selectedBinderId = id;
            _currentPage = 0;
            closeModal();
            showToast(`Created binder "${name}"`, 'success');
            render();
        });
        form.appendChild(createBtn);
        body.appendChild(form);

        setTimeout(() => nameInput.focus(), 100);
    });
}

function openAddToSlotModal(binderId, position) {
    showModal('Add Card to Slot', (body) => {
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
                    binders.addCard(binderId, entry.scryfallId, 1, position);
                    closeModal();
                    showToast(`Added ${entry.cardData?.name || 'card'} to slot`, 'success');
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

function openSlotActionModal(binderId, position, slotData) {
    const cardName = slotData.cardData?.name || 'Card';

    showModal(cardName, (body) => {
        // Card preview
        if (slotData.cardData) {
            const imgUri = getCardImageUri(slotData.cardData, 'normal');
            if (imgUri) {
                const img = document.createElement('img');
                img.src = imgUri;
                img.alt = cardName;
                img.style.cssText = 'width:250px;border-radius:10px;display:block;margin:0 auto 16px;';
                body.appendChild(img);
            }
        }

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'mtg-btn mtg-btn-danger';
        removeBtn.textContent = 'Remove from Slot';
        removeBtn.style.width = '100%';
        removeBtn.addEventListener('click', () => {
            binders.removeCard(binderId, position);
            closeModal();
            showToast(`Removed ${cardName} from slot`, 'info');
            render();
        });
        actions.appendChild(removeBtn);

        body.appendChild(actions);
    });
}

// Listen for state changes
state.subscribe((eventType) => {
    if (eventType === 'binders_changed' || eventType === 'init') {
        const tab = document.getElementById('tab-binders');
        if (tab && tab.classList.contains('active')) {
            render();
        }
    }
});
