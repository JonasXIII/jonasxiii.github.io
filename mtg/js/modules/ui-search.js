// ui-search.js - Scryfall search modal and card adding flow

import * as api from './api.js';
import * as collection from './collection.js';
import * as state from './state.js';
import {
    showModal, closeModal, renderCardTile, renderQuantityControl, renderManaCost, showToast
} from './ui-components.js';

let _searchResults = [];
let _searchQuery = '';
let _searchPage = 1;
let _searchHasMore = false;
let _searchTotal = 0;

export function openSearchModal() {
    _searchResults = [];
    _searchQuery = '';
    _searchPage = 1;

    showModal('Search Scryfall', (body) => {
        // Search bar
        const searchBar = document.createElement('div');
        searchBar.className = 'mtg-search-bar';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Search cards (e.g. "lightning bolt", "t:creature c:red cmc:3")...';
        input.value = _searchQuery;
        input.autofocus = true;

        const searchBtn = document.createElement('button');
        searchBtn.className = 'mtg-btn mtg-btn-primary';
        searchBtn.textContent = 'Search';

        searchBar.appendChild(input);
        searchBar.appendChild(searchBtn);
        body.appendChild(searchBar);

        // Hint
        const hint = document.createElement('p');
        hint.className = 'mtg-search-hint';
        hint.textContent = 'Uses Scryfall search syntax. Try: t:creature, c:red, cmc>=3, set:mh2, o:"draw a card"';
        body.appendChild(hint);

        // Results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-results-container';
        body.appendChild(resultsContainer);

        // Pagination
        const pagination = document.createElement('div');
        pagination.className = 'mtg-search-pagination';
        pagination.id = 'search-pagination';
        body.appendChild(pagination);

        // Events
        const doSearch = async (page = 1) => {
            const query = input.value.trim();
            if (!query) return;

            _searchQuery = query;
            _searchPage = page;

            resultsContainer.innerHTML = '<div class="mtg-search-status">Searching...</div>';
            pagination.innerHTML = '';

            try {
                const result = await api.searchCards(query, page);
                _searchResults = result.data;
                _searchHasMore = result.has_more;
                _searchTotal = result.total_cards;

                renderSearchResults(resultsContainer, pagination);
            } catch (err) {
                resultsContainer.innerHTML = `<div class="mtg-search-status">Error: ${err.message}</div>`;
            }
        };

        searchBtn.addEventListener('click', () => doSearch(1));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch(1);
        });

        // Focus input
        setTimeout(() => input.focus(), 100);
    });
}

function renderSearchResults(container, paginationContainer) {
    container.innerHTML = '';

    if (_searchResults.length === 0) {
        container.innerHTML = '<div class="mtg-search-status">No cards found. Try a different search.</div>';
        return;
    }

    const statusLine = document.createElement('div');
    statusLine.style.cssText = 'font-size:0.9em;color:#888;margin-bottom:8px;';
    statusLine.textContent = `Found ${_searchTotal} card${_searchTotal !== 1 ? 's' : ''} (page ${_searchPage})`;
    container.appendChild(statusLine);

    const grid = document.createElement('div');
    grid.className = 'mtg-search-results';

    for (const card of _searchResults) {
        const tile = document.createElement('div');
        tile.className = 'mtg-search-result';

        const imgUri = api.getCardImageUri(card, 'normal');
        if (imgUri) {
            const img = document.createElement('img');
            img.src = imgUri;
            img.alt = card.name;
            img.loading = 'lazy';
            tile.appendChild(img);
        } else {
            tile.textContent = card.name;
            tile.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:0.85em;padding:8px;';
        }

        tile.addEventListener('click', () => openAddCardFlow(card));
        grid.appendChild(tile);
    }

    container.appendChild(grid);

    // Pagination
    paginationContainer.innerHTML = '';
    if (_searchPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        prevBtn.textContent = 'Previous';
        prevBtn.addEventListener('click', () => {
            const resultsEl = document.getElementById('search-results-container');
            const pagEl = document.getElementById('search-pagination');
            doSearchPage(_searchPage - 1, resultsEl, pagEl);
        });
        paginationContainer.appendChild(prevBtn);
    }
    if (_searchHasMore) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'mtg-btn mtg-btn-secondary mtg-btn-sm';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            const resultsEl = document.getElementById('search-results-container');
            const pagEl = document.getElementById('search-pagination');
            doSearchPage(_searchPage + 1, resultsEl, pagEl);
        });
        paginationContainer.appendChild(nextBtn);
    }
}

async function doSearchPage(page, resultsContainer, paginationContainer) {
    _searchPage = page;
    resultsContainer.innerHTML = '<div class="mtg-search-status">Loading...</div>';
    paginationContainer.innerHTML = '';

    try {
        const result = await api.searchCards(_searchQuery, page);
        _searchResults = result.data;
        _searchHasMore = result.has_more;
        _searchTotal = result.total_cards;
        renderSearchResults(resultsContainer, paginationContainer);
    } catch (err) {
        resultsContainer.innerHTML = `<div class="mtg-search-status">Error: ${err.message}</div>`;
    }
}

function openAddCardFlow(card) {
    // Show modal to select printing and quantity
    showModal('Add: ' + card.name, (body) => {
        // Card info
        const infoRow = document.createElement('div');
        infoRow.style.cssText = 'display:flex;gap:16px;margin-bottom:16px;';

        const imgWrap = document.createElement('div');
        imgWrap.style.cssText = 'width:150px;flex-shrink:0;';
        const imgUri = api.getCardImageUri(card, 'normal');
        if (imgUri) {
            const img = document.createElement('img');
            img.src = imgUri;
            img.alt = card.name;
            img.style.cssText = 'width:100%;border-radius:8px;';
            imgWrap.appendChild(img);
        }
        infoRow.appendChild(imgWrap);

        const textWrap = document.createElement('div');
        const nameEl = document.createElement('h3');
        nameEl.style.margin = '0 0 4px';
        nameEl.textContent = card.name + ' ';
        nameEl.appendChild(renderManaCost(card.mana_cost));
        textWrap.appendChild(nameEl);

        const typeEl = document.createElement('p');
        typeEl.style.cssText = 'color:#666;margin:0 0 8px;';
        typeEl.textContent = card.type_line;
        textWrap.appendChild(typeEl);

        if (card.oracle_text) {
            const oracleEl = document.createElement('div');
            oracleEl.className = 'mtg-card-detail-text';
            oracleEl.textContent = card.oracle_text;
            textWrap.appendChild(oracleEl);
        }

        infoRow.appendChild(textWrap);
        body.appendChild(infoRow);

        // Printings section
        const printingsLabel = document.createElement('h4');
        printingsLabel.textContent = 'Select Printing';
        printingsLabel.style.margin = '0 0 8px';
        body.appendChild(printingsLabel);

        const printingsGrid = document.createElement('div');
        printingsGrid.className = 'mtg-printings-grid';
        printingsGrid.id = 'printings-grid';

        // Show current card as default selected
        let selectedCard = card;

        const defaultOption = createPrintingOption(card, true);
        printingsGrid.appendChild(defaultOption);

        body.appendChild(printingsGrid);

        // Load all printings
        const loadingPrintings = document.createElement('p');
        loadingPrintings.style.cssText = 'font-size:0.85em;color:#999;';
        loadingPrintings.textContent = 'Loading other printings...';
        body.appendChild(loadingPrintings);

        api.fetchPrintings(card.name).then(result => {
            loadingPrintings.remove();
            printingsGrid.innerHTML = '';

            const printings = result.data || [];
            for (const printing of printings) {
                const isSelected = printing.id === selectedCard.id;
                const option = createPrintingOption(printing, isSelected);
                option.addEventListener('click', () => {
                    selectedCard = printing;
                    // Update selection visual
                    printingsGrid.querySelectorAll('.mtg-printing-option').forEach(o => o.classList.remove('selected'));
                    option.classList.add('selected');
                    // Update preview image
                    const previewImg = imgWrap.querySelector('img');
                    if (previewImg) {
                        const newUri = api.getCardImageUri(printing, 'normal');
                        if (newUri) previewImg.src = newUri;
                    }
                });
                printingsGrid.appendChild(option);
            }
        }).catch(err => {
            loadingPrintings.textContent = 'Could not load printings.';
        });

        // Quantity selector
        const qtyRow = document.createElement('div');
        qtyRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-top:16px;';
        const qtyLabel = document.createElement('span');
        qtyLabel.textContent = 'Quantity:';
        qtyLabel.style.fontWeight = '600';
        qtyRow.appendChild(qtyLabel);

        let selectedQty = 1;
        function updateQty(newQty) {
            selectedQty = newQty;
            const newControl = renderQuantityControl(selectedQty, updateQty, 1, 99);
            qtyRow.replaceChild(newControl, qtyRow.lastChild);
        }
        const qtyControl = renderQuantityControl(selectedQty, updateQty, 1, 99);
        qtyRow.appendChild(qtyControl);
        body.appendChild(qtyRow);

        // Check if already in collection
        const existingEntry = state.getCollection()[card.id];
        if (existingEntry) {
            const note = document.createElement('p');
            note.style.cssText = 'font-size:0.85em;color:#667eea;margin-top:8px;';
            note.textContent = `You already own ${existingEntry.quantity}x of this printing. Adding more will increase the count.`;
            body.appendChild(note);
        }

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'mtg-btn mtg-btn-primary';
        addBtn.textContent = 'Add to Collection';
        addBtn.style.cssText = 'margin-top:16px;width:100%;padding:12px;font-size:1.05em;';
        addBtn.addEventListener('click', () => {
            collection.addCard(selectedCard.id, selectedQty, selectedCard);
            showToast(`Added ${selectedQty}x ${selectedCard.name} (${selectedCard.set.toUpperCase()})`, 'success');
            closeModal();
        });
        body.appendChild(addBtn);
    });
}

function createPrintingOption(card, isSelected) {
    const option = document.createElement('div');
    option.className = 'mtg-printing-option' + (isSelected ? ' selected' : '');

    const imgUri = api.getCardImageUri(card, 'small');
    if (imgUri) {
        const img = document.createElement('img');
        img.src = imgUri;
        img.alt = card.set_name || card.set;
        img.loading = 'lazy';
        option.appendChild(img);
    }

    const setLabel = document.createElement('div');
    setLabel.className = 'mtg-printing-set';
    setLabel.textContent = (card.set || '').toUpperCase() + ' #' + (card.collector_number || '');
    option.appendChild(setLabel);

    if (card.prices?.usd) {
        const priceLabel = document.createElement('div');
        priceLabel.className = 'mtg-printing-price';
        priceLabel.textContent = '$' + card.prices.usd;
        option.appendChild(priceLabel);
    }

    return option;
}
