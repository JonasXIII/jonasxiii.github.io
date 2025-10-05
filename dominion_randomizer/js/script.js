// Dominion Kingdom Randomizer - Main Script

const CONFIG = {
    kingdomSize: 10,
};

// DOM Elements
let kingdomContainer, loadingMessage, bonusContainer;

document.addEventListener('DOMContentLoaded', () => {
    kingdomContainer = document.getElementById('kingdom-container');
    loadingMessage = document.getElementById('loading-message');
    bonusContainer = document.getElementById('bonus-container');
    
    document.getElementById('quick-generate')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
    });
    
    generateKingdom();
});


// --- Main Kingdom Generation Logic ---

async function generateKingdom() {
    showLoading();
    try {
        const cardData = await loadCardData();
        const urlParams = new URLSearchParams(window.location.search);
        
        const customSets = urlParams.getAll('expansions');
        const selectedSets = customSets.length > 0 ? customSets : await getSelectedExpansions();

        if (selectedSets.length === 0) {
            throw new Error(`No expansions selected. Go to Customize to select your sets.`);
        }

        const ownedCards = getOwnedCards(cardData, selectedSets);
        
        if (ownedCards.length < CONFIG.kingdomSize) {
            throw new Error(`Not enough cards (${ownedCards.length}) to generate a kingdom. Select more expansions.`);
        }
        
        let kingdom = [...ownedCards].sort(() => 0.5 - Math.random()).slice(0, CONFIG.kingdomSize);
        
        // FIX: Sort the final kingdom by cost, then alphabetically by name for ties.
        kingdom.sort((a, b) => {
            const costA = a.cost.treasure || 0;
            const costB = b.cost.treasure || 0;
            if (costA !== costB) {
                return costA - costB;
            }
            return a.name.localeCompare(b.name);
        });

        const options = {
            eventChance: parseFloat(urlParams.get('eventChance')) || 0.2,
            projectChance: parseFloat(urlParams.get('projectChance')) || 0.2,
            prosperityChance: parseFloat(urlParams.get('prosperityChance')) || 0.2,
            sheltersChance: parseFloat(urlParams.get('sheltersChance')) || 0.3
        };
        
        const bonusCards = generateBonusCards(kingdom, options, cardData, selectedSets);
        displayKingdom(kingdom, bonusCards);
    } catch (error) {
        showError(error.message);
    }
}

// --- Bonus Card Generation ---

function generateBonusCards(kingdom, options, cardData, selectedSets) {
    const bonus = { events: [], projects: [], prophecies: [], prosperity: false, shelters: false };

    // FIX: More robust detection for all special card types.
    const allEvents = getEvents(cardData, selectedSets);
    const allProjects = getProjects(cardData, selectedSets);
    const allProphecies = getProphecies(cardData, selectedSets);

    // Prophecy Logic: Add one if an Omen card is in the kingdom
    if (kingdom.some(card => card.isOmen) && allProphecies.length > 0) {
        bonus.prophecies.push(allProphecies[Math.floor(Math.random() * allProphecies.length)]);
    }

    const kingdomSets = [...new Set(kingdom.map(card => card.setId))];
    const usedIds = new Set();
    
    // Event Logic (max 1)
    if (allEvents.length > 0) {
        for (const setId of kingdomSets) {
            if (bonus.events.length < 1 && allEvents.some(e => e.setId === setId) && Math.random() < options.eventChance) {
                const available = allEvents.filter(e => !usedIds.has(e.id));
                if (available.length > 0) {
                    const randomCard = available[Math.floor(Math.random() * available.length)];
                    bonus.events.push(randomCard);
                    usedIds.add(randomCard.id);
                }
            }
        }
    }

    // Project Logic (max 2)
    if (allProjects.length > 0) {
        for (const setId of kingdomSets) {
            if (bonus.projects.length < 2 && allProjects.some(p => p.setId === setId) && Math.random() < options.projectChance) {
                const available = allProjects.filter(p => !usedIds.has(p.id));
                if (available.length > 0) {
                    const randomCard = available[Math.floor(Math.random() * available.length)];
                    bonus.projects.push(randomCard);
                    usedIds.add(randomCard.id);
                }
            }
        }
    }
    
    // Prosperity & Shelters
    if (kingdom.some(c => c.setId.includes('prosperity')) && Math.random() < options.prosperityChance) {
        bonus.prosperity = true;
    }
    if (kingdom.some(c => c.setId.includes('darkages')) && Math.random() < options.sheltersChance) {
        bonus.shelters = true;
    }
    
    return bonus;
}


// --- Data Loading and Helper Functions ---

async function loadCardData() {
    const response = await fetch('data/dominion_cards.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}

async function getSelectedExpansions() {
    const saved = localStorage.getItem('dominionExpansions');
    if (saved) {
        const selected = Object.entries(JSON.parse(saved)).filter(([, v]) => v).map(([k]) => k);
        if (selected.length > 0) return selected;
    }
    const response = await fetch('data/mysets.json');
    const mySets = await response.json();
    return Object.entries(mySets).filter(([, v]) => v).map(([k]) => k);
}

function getOwnedCards(cardData, selectedSets) {
    return selectedSets.flatMap(setId => 
        (cardData[setId]?.cards || []).filter(card =>
            (card.isAction || card.isTreasure || card.isVictory) && !card.isEvent && !card.isProject
        )
    );
}

// FIX: Dedicated, robust functions to find each special card type.
function getEvents(data, sets) {
    return sets.flatMap(s => (data[s]?.cards || []).filter(c => 
        c.isEvent || 
        (c.types && c.types.includes("Event")) ||
        c.id.includes('_event_') // Fallback check
    ));
}
function getProjects(data, sets) {
     return sets.flatMap(s => (data[s]?.cards || []).filter(c => 
        c.isProject || 
        (c.types && c.types.includes("Project")) ||
        c.id.includes('_project_') // Fallback check
    ));
}
function getProphecies(data, sets) {
    // Prophecies are harder to guess by ID, but we can assume if `isProphecy` is missing, none exist.
    // This relies on the flag being present in your data for any prophecy cards.
    return sets.flatMap(s => (data[s]?.cards || []).filter(c => c.isProphecy));
}

// --- DOM Manipulation and Display ---

function displayKingdom(kingdom, bonusCards) {
    hideLoading();
    kingdomContainer.innerHTML = '';
    bonusContainer.innerHTML = '';
    kingdom.forEach(card => kingdomContainer.appendChild(createCardElement(card)));
    displayBonusCards(bonusCards);
}

function createCardElement(cardData) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';

    const imageContainer = document.createElement('div');
    imageContainer.className = 'card-image-container';

    const cardImage = document.createElement('img');
    cardImage.className = 'card-image';
    cardImage.src = `data/dominion_card_imgs/${cardData.setId}/${cardData.id}.jpg`;
    cardImage.alt = cardData.name;
    cardImage.loading = 'lazy';
    
    const cardFallback = document.createElement('div');
    cardFallback.className = 'card-fallback';
    cardFallback.innerHTML = `<div class="card-name-large">${cardData.name}</div>`;
    
    cardImage.onerror = () => { cardFallback.style.display = 'flex'; cardImage.style.display = 'none'; };
    
    imageContainer.appendChild(cardImage);
    imageContainer.appendChild(cardFallback);
    
    // FIX: The info div now only contains the set name for a minimal look.
    const cardInfo = document.createElement('div');
    cardInfo.className = 'card-info';
    cardInfo.innerHTML = `<div class="card-set">${cardData.setId}</div>`;
    
    cardDiv.appendChild(imageContainer);
    cardDiv.appendChild(cardInfo);
    
    return cardDiv;
}

function displayBonusCards(bonus) {
    const hasBonuses = bonus.events.length || bonus.projects.length || bonus.prophecies.length || bonus.prosperity || bonus.shelters;
    if (!hasBonuses) return;

    bonusContainer.innerHTML = '<h2>Additional Game Elements</h2>';
    const bonusCardsContainer = document.createElement('div');
    bonusCardsContainer.className = 'bonus-cards';

    bonus.events.forEach(c => bonusCardsContainer.appendChild(createBonusCardElement(c, 'event')));
    bonus.projects.forEach(c => bonusCardsContainer.appendChild(createBonusCardElement(c, 'project')));
    bonus.prophecies.forEach(c => bonusCardsContainer.appendChild(createBonusCardElement(c, 'prophecy')));

    if (bonusCardsContainer.children.length > 0) {
        bonusContainer.appendChild(bonusCardsContainer);
    }
    
    // FIX: Re-introduced full HTML with images for Shelters and Prosperity cards.
    if (bonus.prosperity) {
        bonusContainer.insertAdjacentHTML('beforeend', `
            <div class="special-rule">
                <strong>Prosperity Rules:</strong> Use <strong>Platinum</strong> and <strong>Colony</strong> cards.
                <div class="prosperity-images">
                    <div class="prosperity-card">
                        <img src="data/dominion_card_imgs/prosperity/prosperity_platinum.jpg" alt="Platinum" class="prosperity-img">
                        <div class="card-label">Platinum</div>
                    </div>
                    <div class="prosperity-card">
                        <img src="data/dominion_card_imgs/prosperity/prosperity_colony.jpg" alt="Colony" class="prosperity-img">
                        <div class="card-label">Colony</div>
                    </div>
                </div>
            </div>`);
    }
    if (bonus.shelters) {
        bonusContainer.insertAdjacentHTML('beforeend', `
            <div class="special-rule">
                <strong>Dark Ages Rules:</strong> Replace starting Estates with <strong>Shelters</strong>.
                <div class="shelter-images">
                    <div class="shelter-card"><img src="data/dominion_card_imgs/darkages/darkages_hovel.jpg" alt="Hovel" class="shelter-img"><div class="card-label">Hovel</div></div>
                    <div class="shelter-card"><img src="data/dominion_card_imgs/darkages/darkages_necropolis.jpg" alt="Necropolis" class="shelter-img"><div class="card-label">Necropolis</div></div>
                    <div class="shelter-card"><img src="data/dominion_card_imgs/darkages/darkages_overgrownestate.jpg" alt="Overgrown Estate" class="shelter-img"><div class="card-label">Overgrown Estate</div></div>
                </div>
            </div>`);
    }
}

function createBonusCardElement(cardData, type) {
    const cardDiv = document.createElement('div');
    const isHorizontal = type === 'event' || type === 'project';
    cardDiv.className = `bonus-card ${isHorizontal ? 'horizontal' : ''} ${type}`;
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'bonus-card-image-container';
    
    const cardImage = document.createElement('img');
    cardImage.className = 'bonus-card-image';
    cardImage.src = `data/dominion_card_imgs/${cardData.setId}/${cardData.id}.jpg`;
    cardImage.alt = cardData.name;
    cardImage.loading = 'lazy';

    const fallback = document.createElement('div');
    fallback.className = 'bonus-card-fallback';
    fallback.innerHTML = `<div class="bonus-card-name-large">${cardData.name}</div>`;
    
    cardImage.onerror = () => { fallback.style.display = 'flex'; cardImage.style.display = 'none'; };
    
    imageContainer.appendChild(cardImage);
    imageContainer.appendChild(fallback);
    
    const info = document.createElement('div');
    info.className = 'bonus-card-info';
    info.innerHTML = `
        <div class="bonus-card-name">${cardData.name}</div>
        <div class="bonus-card-type">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
    `;
    
    cardDiv.appendChild(imageContainer);
    cardDiv.appendChild(info);
    return cardDiv;
}

function showLoading() {
    if (loadingMessage) loadingMessage.style.display = 'block';
    if (kingdomContainer) kingdomContainer.innerHTML = '';
    if (bonusContainer) bonusContainer.innerHTML = '';
}

function hideLoading() {
    if (loadingMessage) loadingMessage.style.display = 'none';
}

function showError(message) {
    hideLoading();
    if (kingdomContainer) {
        kingdomContainer.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }
}