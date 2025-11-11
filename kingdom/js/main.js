// js/main.js - Main application logic with lock and reroll support
import { loadCards, loadCardLists, getSmartKingdom, rerollSingleCard, getBonusCards } from './modules/kingdom.js';
import { renderKingdom } from './modules/display.js';

// Global state for the current kingdom and card data
let currentState = {
  kingdom: [],
  cardLists: null,
  cards: [],
  events: [],
  projects: [],
  prophecies: [],
  othercards: [],
  lockedCards: new Set(), // Track locked card IDs
  config: {}
};

// Parse URL search params into boolean flags
function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    accs: p.get('accs') === 'true',
    draw: p.get('draw') === 'true',
    blacklist: p.get('blacklist') === 'true',
    baseOnly: p.get('baseOnly') === 'true'
  };
}

// Set URL params and reload page
function writeParams(params) {
  const p = new URLSearchParams();
  if (params.accs) p.set('accs', 'true');
  if (params.draw) p.set('draw', 'true');
  if (params.blacklist) p.set('blacklist', 'true');
  if (params.baseOnly) p.set('baseOnly', 'true');
  window.location.search = p.toString();
}

// Generate a new kingdom respecting locked cards
function generateNewKingdom() {
  // Get locked cards from the current kingdom
  const lockedCards = currentState.kingdom.filter(card => 
    currentState.lockedCards.has(card.id)
  );
  
  // Generate new kingdom with locked cards preserved
  currentState.kingdom = getSmartKingdom(currentState.cardLists, {
    requireAccs: currentState.config.accs,
    requireDraw: currentState.config.draw,
    lockedCards: lockedCards
  });
  
  // Generate bonus cards
  const [upbonuses, sidebonuses] = getBonusCards(
    currentState.cards, 
    currentState.kingdom, 
    currentState.events, 
    currentState.projects, 
    currentState.prophecies, 
    currentState.othercards
  );
  
  // Render the new kingdom
  renderKingdom(currentState.kingdom, 'kingdom-cards', [upbonuses, sidebonuses]);
  
  // Re-apply locked state to UI
  setTimeout(() => {
    currentState.lockedCards.forEach(cardId => {
      const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
      if (cardEl) {
        cardEl.classList.add('locked');
        const lockBtn = cardEl.querySelector('.lock-btn');
        if (lockBtn) {
          lockBtn.innerHTML = '🔓';
          lockBtn.title = 'Unlock this card';
        }
      }
    });
  }, 0);
}

// Handle single card reroll with animation
function handleCardReroll(cardId) {
  const cardToReplace = currentState.kingdom.find(c => c.id === cardId);
  if (!cardToReplace) {
    console.error('Card not found in kingdom:', cardId);
    return;
  }
  
  // Add rerolling animation
  const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
  if (cardEl) {
    cardEl.classList.add('rerolling');
  }
  
  // Lock all other cards temporarily
  const originalLocked = new Set(currentState.lockedCards);
  currentState.kingdom.forEach(card => {
    if (card.id !== cardId) {
      currentState.lockedCards.add(card.id);
    }
  });
  
  // Reroll this specific card
  setTimeout(() => {
    currentState.kingdom = rerollSingleCard(
      cardToReplace,
      currentState.kingdom,
      currentState.cardLists,
      {
        requireAccs: currentState.config.accs,
        requireDraw: currentState.config.draw
      }
    );
    
    // Restore original locked state
    currentState.lockedCards = originalLocked;
    
    // Generate new bonus cards (they might change based on the new card)
    const [upbonuses, sidebonuses] = getBonusCards(
      currentState.cards, 
      currentState.kingdom, 
      currentState.events, 
      currentState.projects, 
      currentState.prophecies, 
      currentState.othercards
    );
    
    // Re-render
    renderKingdom(currentState.kingdom, 'kingdom-cards', [upbonuses, sidebonuses]);
    
    // Re-apply locked state to UI
    setTimeout(() => {
      currentState.lockedCards.forEach(lockedCardId => {
        const lockedCardEl = document.querySelector(`[data-card-id="${lockedCardId}"]`);
        if (lockedCardEl) {
          lockedCardEl.classList.add('locked');
          const lockBtn = lockedCardEl.querySelector('.lock-btn');
          if (lockBtn) {
            lockBtn.innerHTML = '🔓';
            lockBtn.title = 'Unlock this card';
          }
        }
      });
    }, 0);
  }, 300); // Wait for animation to reach midpoint
}

// Handle card lock/unlock
function handleCardLock(cardId, isLocking) {
  if (isLocking) {
    currentState.lockedCards.add(cardId);
  } else {
    currentState.lockedCards.delete(cardId);
  }
}

// Make functions available globally for the display module
window.dominionHandlers = {
  handleCardReroll,
  handleCardLock
};

document.addEventListener('DOMContentLoaded', async () => {
  const accsBox = document.getElementById('accs');
  const drawBox = document.getElementById('draw');
  const blacklistBox = document.getElementById('blacklist');
  const baseOnlyBox = document.getElementById('baseOnly');
  const generateBtn = document.getElementById('generate');

  // 1) Read params, reflect in UI
  const params = readParams();
  currentState.config = params;
  accsBox.checked = params.accs;
  drawBox.checked = params.draw;
  blacklistBox.checked = params.blacklist;
  baseOnlyBox.checked = params.baseOnly;

  // 2) Load card data
  const { cards, events, projects, prophecies, othercards } = await loadCards({ 
    baseOnly: params.baseOnly, 
    applyBlacklist: params.blacklist 
  });
  
  currentState.cards = cards;
  currentState.events = events;
  currentState.projects = projects;
  currentState.prophecies = prophecies;
  currentState.othercards = othercards;

  // 3) Create card lists for efficient filtering
  currentState.cardLists = await loadCardLists(cards, events, projects, prophecies, othercards);
  
  // 4) Generate initial kingdom
  generateNewKingdom();

  // 5) Setup Generate button - now it respects locked cards
  generateBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    
    // Check if settings changed
    const settingsChanged = 
      accsBox.checked !== currentState.config.accs ||
      drawBox.checked !== currentState.config.draw ||
      blacklistBox.checked !== currentState.config.blacklist ||
      baseOnlyBox.checked !== currentState.config.baseOnly;
    
    if (settingsChanged) {
      // Settings changed, need full reload
      const newParams = {
        accs: accsBox.checked,
        draw: drawBox.checked,
        blacklist: blacklistBox.checked,
        baseOnly: baseOnlyBox.checked
      };
      writeParams(newParams);
    } else {
      // Just generate new kingdom with current settings
      generateNewKingdom();
    }
  });

  // 6) Close overlay when clicking outside cards
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card')) {
      document.querySelectorAll('.card.active').forEach(card => {
        card.classList.remove('active');
      });
    }
  });
});