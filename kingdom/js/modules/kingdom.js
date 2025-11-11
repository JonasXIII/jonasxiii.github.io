// js/modules/kingdom.js - Kingdom generation with lock/reroll support

// Load dominion cards, owned sets and blacklist
export async function loadCards(options = {}) {
  const { baseOnly = false, applyBlacklist = false } = options;

  // Load all three JSON files at once
  const [cardsRes, setsRes, blacklistRes] = await Promise.all([
    fetch('./data/dominion_cards.json'),
    fetch('./data/mysets.json'),
    fetch('./data/blacklist.json')
  ]);

  if (!cardsRes.ok) throw new Error('Failed loading dominion_cards.json');
  if (!setsRes.ok) throw new Error('Failed loading mysets.json');
  if (!blacklistRes.ok) console.warn('no blacklist.json found; continuing with empty blacklist');

  // Parse data
  const cardsData = await cardsRes.json();
  const mysets = await setsRes.json();
  const blacklist = blacklistRes.ok ? await blacklistRes.json() : [];

  // Containers for each type
  const cards = [];
  const events = [];
  const projects = [];
  const prophecies = [];
  const othercards = [];

  // Loop through each expansion
  for (const [setId, setInfo] of Object.entries(cardsData)) {
    if (!mysets[setId]) continue; // skip sets the player doesn't own
    if (baseOnly && setId !== 'baseset2') continue;

    // Utility to safely handle each group type
    const addCardsFromGroup = (group, targetArray) => {
      if (!Array.isArray(group)) return;
      for (const c of group) {
        if (applyBlacklist && blacklist.includes(c.id)) continue;
        targetArray.push({ ...c, setId });
      }
    };

    // Add each kind of card type if present
    addCardsFromGroup(setInfo.cards, cards);
    addCardsFromGroup(setInfo.events, events);
    addCardsFromGroup(setInfo.projects, projects);
    addCardsFromGroup(setInfo.prophecies, prophecies);
    addCardsFromGroup(setInfo.othercards, othercards);
  }

  return { cards, events, projects, prophecies, othercards };
}

// Create categorized lists of cards for efficient filtering
export async function loadCardLists(cards, events, projects, prophecies, othercards) {
  // Create filtered lists for common requirements
  const actionSuppliers = cards.filter(c => c.isActionSupplier);
  const drawers = cards.filter(c => c.isDrawer);
  const attacks = cards.filter(c => c.isAttack);
  const reactions = cards.filter(c => c.isReaction);
  const durations = cards.filter(c => c.isDuration);
  
  // Cards that satisfy multiple requirements (useful for optimization)
  const actionDrawers = cards.filter(c => c.isActionSupplier && c.isDrawer);
  
  // Cost-based lists for balanced kingdoms
  const cheapCards = cards.filter(c => cardCostValue(c) <= 3);
  const midCards = cards.filter(c => cardCostValue(c) === 4 || cardCostValue(c) === 5);
  const expensiveCards = cards.filter(c => cardCostValue(c) >= 6);
  
  return {
    all: cards,
    actionSuppliers,
    drawers,
    attacks,
    reactions,
    durations,
    actionDrawers,
    byCode: new Map(cards.map(c => [c.id, c])),
    cheapCards,
    midCards,
    expensiveCards
  };
}

// Utility functions
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardCostValue(card) {
  const treasure = (card.cost && card.cost.treasure) ? card.cost.treasure : 0;
  const potion = (card.cost && card.cost.potion) ? card.cost.potion : 0;
  const debt = (card.cost && card.cost.debt) ? card.cost.debt : 0;
  return treasure + debt + potion * 10;
}

// Smart kingdom generation that starts with requirements
export function getSmartKingdom(cardLists, config = {}) {
  const { 
    requireAccs = false, 
    requireDraw = false,
    lockedCards = []  // Array of card objects that must be included
  } = config;
  
  const targetSize = 10;
  const kingdom = [...lockedCards]; // Start with locked cards
  const usedIds = new Set(lockedCards.map(c => c.id));
  
  // Check if locked cards already satisfy requirements
  let needsActions = requireAccs && !kingdom.some(c => c.isActionSupplier);
  let needsDraw = requireDraw && !kingdom.some(c => c.isDrawer);
  
  // Function to add a card if it's not already used
  const tryAddCard = (card) => {
    if (!usedIds.has(card.id)) {
      kingdom.push(card);
      usedIds.add(card.id);
      return true;
    }
    return false;
  };
  
  // 1. First, try to satisfy both requirements with one card if needed
  if (needsActions && needsDraw && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.actionDrawers.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      if (tryAddCard(candidates[0])) {
        needsActions = false;
        needsDraw = false;
      }
    }
  }
  
  // 2. Satisfy remaining individual requirements
  if (needsActions && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.actionSuppliers.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
    }
  }
  
  if (needsDraw && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.drawers.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
    }
  }
  
  // 3. Fill remaining slots randomly
  const remainingCards = shuffle(cardLists.all.filter(c => !usedIds.has(c.id)));
  while (kingdom.length < targetSize && remainingCards.length > 0) {
    kingdom.push(remainingCards.pop());
  }
  
  // Sort by cost
  kingdom.sort((a, b) => cardCostValue(a) - cardCostValue(b));
  return kingdom;
}

// Reroll a single card while respecting requirements
export function rerollSingleCard(cardToReplace, currentKingdom, cardLists, config = {}) {
  const { requireAccs = false, requireDraw = false } = config;
  
  // Create a new kingdom without the card to replace
  const kingdomWithoutTarget = currentKingdom.filter(c => c.id !== cardToReplace.id);
  
  // Check if removing this card breaks any requirements
  const targetWasActionSupplier = cardToReplace.isActionSupplier;
  const targetWasDrawer = cardToReplace.isDrawer;
  
  const stillHasActions = kingdomWithoutTarget.some(c => c.isActionSupplier);
  const stillHasDraw = kingdomWithoutTarget.some(c => c.isDrawer);
  
  const needsActions = requireAccs && targetWasActionSupplier && !stillHasActions;
  const needsDraw = requireDraw && targetWasDrawer && !stillHasDraw;
  
  // Get current kingdom card IDs to exclude
  const usedIds = new Set(kingdomWithoutTarget.map(c => c.id));
  
  // Build candidate pool based on requirements
  let candidates;
  if (needsActions && needsDraw) {
    // Need both - prioritize cards that satisfy both
    candidates = cardLists.actionDrawers.filter(c => !usedIds.has(c.id));
    if (candidates.length === 0) {
      // If no dual-purpose cards, just get action suppliers (draw is less critical usually)
      candidates = cardLists.actionSuppliers.filter(c => !usedIds.has(c.id));
    }
  } else if (needsActions) {
    candidates = cardLists.actionSuppliers.filter(c => !usedIds.has(c.id));
  } else if (needsDraw) {
    candidates = cardLists.drawers.filter(c => !usedIds.has(c.id));
  } else {
    // No specific requirements, any card will do
    candidates = cardLists.all.filter(c => !usedIds.has(c.id));
  }
  
  if (candidates.length === 0) {
    console.warn('No valid candidates for reroll');
    return currentKingdom; // Return unchanged
  }
  
  // Pick a random replacement
  const replacement = candidates[Math.floor(Math.random() * candidates.length)];
  
  // Create new kingdom with replacement
  const newKingdom = [...kingdomWithoutTarget, replacement];
  newKingdom.sort((a, b) => cardCostValue(a) - cardCostValue(b));
  
  return newKingdom;
}

// Legacy function for backward compatibility - redirects to smart generation
export function getRandomKingdom(cardsPool, config = {}) {
  // Create a simple cardLists object from the pool
  const cardLists = {
    all: cardsPool,
    actionSuppliers: cardsPool.filter(c => c.isActionSupplier),
    drawers: cardsPool.filter(c => c.isDrawer),
    actionDrawers: cardsPool.filter(c => c.isActionSupplier && c.isDrawer)
  };
  
  return getSmartKingdom(cardLists, config);
}

// Bonus card generation functions
function getRandEventCard(events) {
  if (!Array.isArray(events) || events.length === 0) return null;
  const index = Math.floor(Math.random() * events.length);
  return events[index];
}

function getRandProjectCard(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return null;
  const index = Math.floor(Math.random() * projects.length);
  return projects[index];
}

function getTwoRandProjectCard(projects) {
  if (!Array.isArray(projects) || projects.length < 2) return null;
  const shuffled = shuffle(projects);
  return [shuffled[0], shuffled[1]];
}

function getShelterCards(othercards) {
  if (!Array.isArray(othercards)) return [];
  return othercards.filter(card => 
    typeof card.type === "string" && card.type.includes("Shelter")
  );
}

function getPlatinumCard(othercards) {
  if (!Array.isArray(othercards)) return [];
  return othercards.filter(card => card.name === "Platinum");
}

function getColonyCard(othercards) {
  if (!Array.isArray(othercards)) return [];
  return othercards.filter(card => card.name === "Colony");
}

function getRiverboatBonusCard(allCards, kingdom) {
  if (!Array.isArray(allCards) || !Array.isArray(kingdom)) return [];
  const kingdomIds = new Set(kingdom.map(c => c.id));
  const candidates = allCards.filter(card =>
    card.cost?.treasure === 5 &&
    !card.isDuration &&
    !kingdomIds.has(card.id)
  );
  if (candidates.length === 0) return null;
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

function getProphecyCard(prophecies) {
  if (!Array.isArray(prophecies) || prophecies.length === 0) return null;
  const index = Math.floor(Math.random() * prophecies.length);
  return prophecies[index];
}

export function getBonusCards(cardPool, kingdom, events, projects, prophecies, othercards) {
  let event = false;
  let project = false;
  let doubleProject = false;
  let shelters = false;
  let platinum = false;
  let colony = false;
  let river_boat = false;
  let prophecy = false;

  for (const card of kingdom) {
    if (card.setId === 'renaissance' && Math.random() < 0.2) project = true;
    if (card.setId === 'renaissance' && Math.random() < 0.2 && project) doubleProject = true;
    if (card.setId === 'risingsun' && Math.random() < 0.2) event = true;
    if (card.setId === 'darkages' && Math.random() < 0.2) shelters = true;
    if (card.setId === 'prosperity' && Math.random() < 0.2) platinum = true;
    if (card.setId === 'prosperity' && Math.random() < 0.2) colony = true;
    if (card.name === 'Riverboat') river_boat = true;
    if (card.isOmen) prophecy = true;
  }

  const upbonuses = [];
  const sidebonuses = [];
  if (shelters) upbonuses.push(...getShelterCards(othercards));
  if (platinum) upbonuses.push(...getPlatinumCard(othercards));
  if (colony) upbonuses.push(...getColonyCard(othercards));
  
  if(doubleProject) {
    sidebonuses.push(...getTwoRandProjectCard(projects));
  } else if (project) {
    const projectCard = getRandProjectCard(projects);
    if (projectCard) sidebonuses.push(projectCard);
  }
  if (river_boat) {
    const riverboatCard = getRiverboatBonusCard(cardPool, kingdom);
    if (riverboatCard) upbonuses.push(riverboatCard);
  }
  if (prophecy) {
    const prophecyCard = getProphecyCard(prophecies);
    if (prophecyCard) sidebonuses.push(prophecyCard);
  }
  if (event) {
    const eventCard = getRandEventCard(events);
    if (eventCard) sidebonuses.push(eventCard);
  }

  return [upbonuses, sidebonuses];
}