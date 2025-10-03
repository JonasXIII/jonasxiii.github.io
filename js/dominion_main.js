// js/main.js

// --- 1. DATA FETCHING ---

async function loadCardData() {
    try {
        const response = await fetch('data/dominion_cards.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Could not load card data:", error);
        return null;
    }
}

async function loadMySets() {
    try {
        const response = await fetch('data/mysets.json');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Could not load your set data:", error);
        return null;
    }
}

async function loadBlacklist() {
    try {
        const response = await fetch('data/blacklist.json');
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error("Could not load blacklist:", error);
        return [];
    }
}

async function loadPriorityCards() {
    try {
        const response = await fetch('data/priority_cards.json');
        if (!response.ok) return {};
        return await response.json();
    } catch (error) {
        console.error("Could not load priority cards:", error);
        return {};
    }
}

// --- 2. CORE LOGIC ---

function getOwnedCards(allCards, mySets, blacklist = []) {
    if (!allCards || !mySets) return [];
    const ownedCardPool = [];
    const ownedSetIds = Object.keys(mySets).filter(setId => mySets[setId]);

    for (const setId of ownedSetIds) {
        if (allCards[setId] && allCards[setId].cards) {
            const cards = allCards[setId].cards.filter(card => 
                !blacklist.includes(card.id)
            );
            ownedCardPool.push(...cards);
        }
    }
    return ownedCardPool;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function selectPriorityCards(cardPool, priorityCards) {
    const selected = [];
    for (const [cardId, probability] of Object.entries(priorityCards)) {
        if (Math.random() < probability) {
            const card = cardPool.find(c => c.id === cardId);
            if (card) {
                selected.push(card);
            }
        }
    }
    return selected;
}

function hasAlchemyCards(kingdom) {
    return kingdom.some(card => card.setId === 'alchemy');
}

function countAlchemyCards(kingdom) {
    return kingdom.filter(card => card.setId === 'alchemy').length;
}

function generateRandomKingdom(cardPool, allCards, mySets, options = {}) {
    const kingdom = [];
    const usedCardIds = new Set();
    
    // Shuffle pool
    const shuffledPool = [...cardPool];
    shuffleArray(shuffledPool);
    
    // Add cards to kingdom
    for (const card of shuffledPool) {
        if (kingdom.length >= 10) break;
        if (!usedCardIds.has(card.id)) {
            kingdom.push(card);
            usedCardIds.add(card.id);
        }
    }
    
    // Handle alchemy requirement if enabled
    if (options.forceAlchemy && hasAlchemyCards(kingdom)) {
        const alchemyCount = countAlchemyCards(kingdom);
        if (alchemyCount < 3) {
            const alchemyCards = cardPool.filter(c => 
                c.setId === 'alchemy' && !usedCardIds.has(c.id)
            );
            shuffleArray(alchemyCards);
            
            const needed = 3 - alchemyCount;
            const toRemove = kingdom.filter(c => c.setId !== 'alchemy').slice(0, needed);
            
            for (const card of toRemove) {
                const index = kingdom.indexOf(card);
                if (index > -1 && alchemyCards.length > 0) {
                    kingdom[index] = alchemyCards.shift();
                    usedCardIds.add(kingdom[index].id);
                }
            }
        }
    }
    
    // Handle events (20% chance if kingdom contains cards from sets with events)
    const extras = generateExtras(kingdom, allCards, mySets);
    
    return { kingdom, ...extras };
}

function generateCustomKingdom(cardPool, allCards, mySets, options, priorityCards = {}) {
    const kingdom = [];
    const usedCardIds = new Set();
    let remainingCards = [...cardPool];
    
    // First, add priority cards
    const prioritySelected = selectPriorityCards(remainingCards, priorityCards);
    for (const card of prioritySelected) {
        if (kingdom.length < 10) {
            kingdom.push(card);
            usedCardIds.add(card.id);
            remainingCards = remainingCards.filter(c => c.id !== card.id);
        }
    }
    
    // Helper function to add a required card
    const addRequiredCard = (filter) => {
        const candidates = remainingCards.filter(filter);
        if (candidates.length > 0 && kingdom.length < 10) {
            const chosenCard = candidates[Math.floor(Math.random() * candidates.length)];
            kingdom.push(chosenCard);
            usedCardIds.add(chosenCard.id);
            remainingCards = remainingCards.filter(c => c.id !== chosenCard.id);
        }
    };
    
    // Add required card types
    if (options.forceVillage) addRequiredCard(c => c.isActionSupplier);
    if (options.forceTrashing) addRequiredCard(c => c.isTrashing);
    if (options.forceBuy) addRequiredCard(c => c.isBuySupplier);
    if (options.forceAttack) addRequiredCard(c => c.isAttack);
    
    // Fill remaining slots
    shuffleArray(remainingCards);
    for (const card of remainingCards) {
        if (kingdom.length >= 10) break;
        if (!usedCardIds.has(card.id)) {
            kingdom.push(card);
            usedCardIds.add(card.id);
        }
    }
    
    // Handle alchemy requirement if enabled
    if (options.forceAlchemy && hasAlchemyCards(kingdom)) {
        const alchemyCount = countAlchemyCards(kingdom);
        if (alchemyCount < 3) {
            const alchemyCards = cardPool.filter(c => 
                c.setId === 'alchemy' && !usedCardIds.has(c.id)
            );
            shuffleArray(alchemyCards);
            
            const needed = Math.min(3 - alchemyCount, alchemyCards.length);
            const toRemove = kingdom.filter(c => c.setId !== 'alchemy').slice(0, needed);
            
            for (let i = 0; i < needed && i < alchemyCards.length; i++) {
                const index = kingdom.indexOf(toRemove[i]);
                if (index > -1) {
                    kingdom[index] = alchemyCards[i];
                    usedCardIds.add(kingdom[index].id);
                }
            }
        }
    }
    
    // Handle events and prophecies
    const extras = generateExtras(kingdom, allCards, mySets);
    
    return { kingdom, ...extras };
}

function generateExtras(kingdom, allCards, mySets) {
    const result = { events: [], prophecy: null };
    const usedSets = new Set(kingdom.map(card => card.setId));
    
    // Check for omen cards (force prophecy)
    const hasOmen = kingdom.some(card => card.isOmen);
    
    // Check for sets with events and 20% chance
    const setsWithEvents = [];
    for (const setId of usedSets) {
        if (allCards[setId] && allCards[setId].events && allCards[setId].events.length > 0) {
            setsWithEvents.push(allCards[setId].events);
        }
    }
    
    if (setsWithEvents.length > 0 && Math.random() < 0.2) {
        // Flatten all events and pick one
        const allEvents = setsWithEvents.flat();
        if (allEvents.length > 0) {
            const randomEvent = allEvents[Math.floor(Math.random() * allEvents.length)];
            result.events.push(randomEvent);
        }
    }
    
    // Handle prophecy for Rising Sun
    if (hasOmen && usedSets.has('risingsun') && allCards.risingsun && allCards.risingsun.prophecies) {
        const prophecies = allCards.risingsun.prophecies;
        if (prophecies.length > 0) {
            result.prophecy = prophecies[Math.floor(Math.random() * prophecies.length)];
        }
    }
    
    return result;
}

// --- 3. DISPLAY LOGIC ---

function displayKingdom(kingdomData) {
    const container = document.getElementById('kingdom-container');
    const loadingMessage = document.getElementById('loading-message');
    if (!container || !loadingMessage) return;
    
    loadingMessage.style.display = 'none';
    container.innerHTML = '';
    
    const { kingdom, events, prophecy } = kingdomData;
    
    if (!kingdom || kingdom.length === 0) {
        container.innerHTML = '<p>Could not generate a kingdom. Please check your data files and owned sets.</p>';
        return;
    }
    
    // Display kingdom cards
    for (const card of kingdom) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        
        const cardImage = document.createElement('img');
        // Use local image path
        cardImage.src = `data/dominion_card_imgs/${card.setId}/${card.id}.jpg`;
        cardImage.alt = card.name;
        cardImage.onerror = function() { 
            this.style.display = 'none'; 
            cardName.style.padding = '20px';
        };
        
        const cardName = document.createElement('div');
        cardName.className = 'card-name';
        cardName.textContent = card.name;
        
        cardDiv.appendChild(cardImage);
        cardDiv.appendChild(cardName);
        container.appendChild(cardDiv);
    }
    
    // Display events if present
    if (events && events.length > 0) {
        const eventsSection = document.createElement('div');
        eventsSection.style.marginTop = '2rem';
        eventsSection.innerHTML = '<h2>Events</h2>';
        
        for (const event of events) {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'card';
            
            const eventImage = document.createElement('img');
            eventImage.src = `data/dominion_card_imgs/${event.setId}/${event.id}.jpg`;
            eventImage.alt = event.name;
            eventImage.onerror = function() { this.style.display = 'none'; };
            
            const eventName = document.createElement('div');
            eventName.className = 'card-name';
            eventName.textContent = event.name;
            
            eventDiv.appendChild(eventImage);
            eventDiv.appendChild(eventName);
            eventsSection.appendChild(eventDiv);
        }
        
        container.appendChild(eventsSection);
    }
    
    // Display prophecy if present
    if (prophecy) {
        const prophecySection = document.createElement('div');
        prophecySection.style.marginTop = '2rem';
        prophecySection.innerHTML = '<h2>Prophecy</h2>';
        
        const prophecyDiv = document.createElement('div');
        prophecyDiv.className = 'card';
        
        const prophecyImage = document.createElement('img');
        prophecyImage.src = `data/dominion_card_imgs/${prophecy.setId}/${prophecy.id}.jpg`;
        prophecyImage.alt = prophecy.name;
        prophecyImage.onerror = function() { this.style.display = 'none'; };
        
        const prophecyName = document.createElement('div');
        prophecyName.className = 'card-name';
        prophecyName.textContent = prophecy.name;
        
        prophecyDiv.appendChild(prophecyImage);
        prophecyDiv.appendChild(prophecyName);
        prophecySection.appendChild(prophecyDiv);
        
        container.appendChild(prophecySection);
    }
}

// --- 4. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('kingdom-container')) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    
    const [allCards, mySets, blacklist, priorityCards] = await Promise.all([
        loadCardData(),
        loadMySets(),
        loadBlacklist(),
        loadPriorityCards()
    ]);
    
    const ownedCards = getOwnedCards(allCards, mySets, blacklist);
    
    let result;
    
    if (urlParams.get('mode') === 'quick') {
        result = generateRandomKingdom(ownedCards, allCards, mySets);
    } else {
        const options = {
            forceVillage: urlParams.get('forceVillage') === 'true',
            forceTrashing: urlParams.get('forceTrashing') === 'true',
            forceBuy: urlParams.get('forceBuy') === 'true',
            forceAttack: urlParams.get('forceAttack') === 'true',
            forceAlchemy: urlParams.get('forceAlchemy') === 'true',
        };
        result = generateCustomKingdom(ownedCards, allCards, mySets, options, priorityCards);
    }
    
    displayKingdom(result);
    
    // Make the regenerate button work
    const regenerateBtn = document.querySelector('.regenerate-button');
    if (regenerateBtn) {
        regenerateBtn.href = window.location.href;
        regenerateBtn.onclick = (e) => {
            e.preventDefault();
            window.location.reload();
        };
    }
});