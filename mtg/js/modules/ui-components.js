// ui-components.js - Shared UI components

import { getCardImageUri, isMultiFaced } from './api.js';
import * as state from './state.js';

// --- Card Tile ---

export function renderCardTile(scryfallId, cardData, options = {}) {
    const el = document.createElement('div');
    el.className = 'mtg-card-tile';
    el.dataset.scryfallId = scryfallId;

    let currentFace = 0;

    const imgUri = getCardImageUri(cardData, options.imageSize || 'normal');
    if (imgUri) {
        const img = document.createElement('img');
        img.src = imgUri;
        img.alt = cardData.name || 'Card';
        img.loading = 'lazy';
        img.onerror = function () {
            this.style.display = 'none';
            const ph = document.createElement('div');
            ph.className = 'mtg-card-placeholder';
            ph.textContent = cardData.name || 'Unknown Card';
            el.insertBefore(ph, el.firstChild);
        };
        el.appendChild(img);
    } else {
        const ph = document.createElement('div');
        ph.className = 'mtg-card-placeholder';
        ph.textContent = cardData?.name || 'Unknown Card';
        el.appendChild(ph);
    }

    // Price overlay on hover
    if (cardData?.prices?.usd) {
        const priceOverlay = document.createElement('div');
        priceOverlay.className = 'mtg-card-price-overlay';
        priceOverlay.textContent = '$' + cardData.prices.usd;
        el.appendChild(priceOverlay);
    }

    // Flip button for double-faced cards
    if (cardData && isMultiFaced(cardData)) {
        const flipBtn = document.createElement('button');
        flipBtn.className = 'mtg-card-flip-btn';
        flipBtn.innerHTML = '&#x21BB;'; // ↻ rotation arrow
        flipBtn.title = 'Flip card';
        flipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            currentFace = (currentFace + 1) % cardData.card_faces.length;
            const newUri = getCardImageUri(cardData, options.imageSize || 'normal', currentFace);
            const img = el.querySelector('img');
            if (img && newUri) {
                el.classList.add('mtg-card-flipping');
                setTimeout(() => {
                    img.src = newUri;
                    el.classList.remove('mtg-card-flipping');
                }, 150);
            }
        });
        el.appendChild(flipBtn);
    }

    if (options.onClick) {
        el.addEventListener('click', () => options.onClick(scryfallId, cardData));
    }

    return el;
}

// --- Card Grid ---
// Each card entry is expanded to show one tile per copy owned

export function renderCardGrid(cards, containerId, options = {}) {
    const container = document.getElementById(containerId) || document.createElement('div');
    if (!container.id) container.id = containerId;

    const grid = document.createElement('div');
    grid.className = 'mtg-card-grid';

    for (const card of cards) {
        const count = card.quantity || 1;
        for (let i = 0; i < count; i++) {
            const tile = renderCardTile(card.scryfallId, card.cardData, {
                imageSize: options.imageSize,
                onClick: options.onCardClick
            });
            grid.appendChild(tile);
        }
    }

    return grid;
}

// --- Quantity Control ---

export function renderQuantityControl(current, onChange, min = 0, max = 99) {
    const wrap = document.createElement('div');
    wrap.className = 'mtg-quantity-control';

    const minusBtn = document.createElement('button');
    minusBtn.textContent = '-';
    minusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (current > min) onChange(current - 1);
    });

    const display = document.createElement('span');
    display.textContent = current;

    const plusBtn = document.createElement('button');
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (current < max) onChange(current + 1);
    });

    wrap.appendChild(minusBtn);
    wrap.appendChild(display);
    wrap.appendChild(plusBtn);
    return wrap;
}

// --- Modal ---

export function showModal(title, contentFn, options = {}) {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    if (!overlay || !container) return;

    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'mtg-modal-header';
    const h2 = document.createElement('h2');
    h2.textContent = title;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'mtg-modal-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeModal);
    header.appendChild(h2);
    header.appendChild(closeBtn);
    container.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'mtg-modal-body';
    container.appendChild(body);

    contentFn(body);

    // Footer (optional)
    if (options.footer) {
        const footer = document.createElement('div');
        footer.className = 'mtg-modal-footer';
        options.footer(footer);
        container.appendChild(footer);
    }

    overlay.style.display = 'flex';

    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) closeModal();
    };

    // Close on Escape
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

export function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- Toast ---

export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `mtg-toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-out 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// --- Filter Bar (for sidebar) ---

export function renderFilterBar(container, filters, onFilterChange) {
    container.innerHTML = '';

    // Name search
    const nameSection = createFilterSection('Search');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'mtg-search-input';
    nameInput.placeholder = 'Filter by name...';
    nameInput.value = filters.name || '';
    nameInput.style.width = '100%';
    nameInput.style.boxSizing = 'border-box';
    nameInput.addEventListener('input', () => {
        filters.name = nameInput.value;
        onFilterChange(filters);
    });
    nameSection.appendChild(nameInput);
    container.appendChild(nameSection);

    // Color filter
    const colorSection = createFilterSection('Colors');
    const colorWrap = document.createElement('div');
    colorWrap.className = 'mtg-color-filters';
    const colors = [
        { code: 'W', label: 'W' },
        { code: 'U', label: 'U' },
        { code: 'B', label: 'B' },
        { code: 'R', label: 'R' },
        { code: 'G', label: 'G' },
        { code: 'C', label: 'C' }
    ];
    for (const color of colors) {
        const btn = document.createElement('button');
        btn.className = 'mtg-color-btn' + ((filters.colors || []).includes(color.code) ? ' active' : '');
        btn.dataset.color = color.code;
        btn.textContent = color.label;
        btn.title = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }[color.code];
        btn.addEventListener('click', () => {
            if (!filters.colors) filters.colors = [];
            const idx = filters.colors.indexOf(color.code);
            if (idx >= 0) {
                filters.colors.splice(idx, 1);
                btn.classList.remove('active');
            } else {
                filters.colors.push(color.code);
                btn.classList.add('active');
            }
            onFilterChange(filters);
        });
        colorWrap.appendChild(btn);
    }
    colorSection.appendChild(colorWrap);
    container.appendChild(colorSection);

    // Type filter
    const typeSection = createFilterSection('Type');
    const typeSelect = document.createElement('select');
    typeSelect.className = 'mtg-select';
    typeSelect.style.width = '100%';
    const types = ['all', 'creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'planeswalker', 'land'];
    for (const t of types) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1);
        if (filters.type === t) opt.selected = true;
        typeSelect.appendChild(opt);
    }
    typeSelect.addEventListener('change', () => {
        filters.type = typeSelect.value;
        onFilterChange(filters);
    });
    typeSection.appendChild(typeSelect);
    container.appendChild(typeSection);

    // Rarity filter
    const raritySection = createFilterSection('Rarity');
    const raritySelect = document.createElement('select');
    raritySelect.className = 'mtg-select';
    raritySelect.style.width = '100%';
    const rarities = ['all', 'common', 'uncommon', 'rare', 'mythic'];
    for (const r of rarities) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r === 'all' ? 'All Rarities' : r.charAt(0).toUpperCase() + r.slice(1);
        if (filters.rarity === r) opt.selected = true;
        raritySelect.appendChild(opt);
    }
    raritySelect.addEventListener('change', () => {
        filters.rarity = raritySelect.value;
        onFilterChange(filters);
    });
    raritySection.appendChild(raritySelect);
    container.appendChild(raritySection);

    // Stats
    const stats = document.createElement('div');
    stats.className = 'mtg-stats-summary';
    stats.id = 'collection-stats';
    container.appendChild(stats);
}

function createFilterSection(title) {
    const section = document.createElement('div');
    section.className = 'mtg-filter-section';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    section.appendChild(h3);
    return section;
}

// --- Mana Cost Rendering ---

export function renderManaCost(manaCost) {
    if (!manaCost) return document.createDocumentFragment();
    const frag = document.createDocumentFragment();
    const symbols = manaCost.match(/\{[^}]+\}/g) || [];
    for (const sym of symbols) {
        const inner = sym.replace(/[{}]/g, '');
        const span = document.createElement('span');
        if (['W', 'U', 'B', 'R', 'G'].includes(inner)) {
            span.className = `mtg-mana mtg-mana-${inner}`;
            span.textContent = inner;
        } else if (inner === 'C') {
            span.className = 'mtg-mana mtg-mana-C';
            span.textContent = 'C';
        } else {
            span.className = 'mtg-mana mtg-mana-generic';
            span.textContent = inner;
        }
        frag.appendChild(span);
    }
    return frag;
}

// --- Empty State ---

export function renderEmptyState(container, title, message, buttonText, onButton) {
    const wrap = document.createElement('div');
    wrap.className = 'mtg-empty-state';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    const p = document.createElement('p');
    p.textContent = message;
    wrap.appendChild(h3);
    wrap.appendChild(p);
    if (buttonText && onButton) {
        const btn = document.createElement('button');
        btn.className = 'mtg-btn mtg-btn-primary';
        btn.textContent = buttonText;
        btn.addEventListener('click', onButton);
        wrap.appendChild(btn);
    }
    container.appendChild(wrap);
}
