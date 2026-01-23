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
  const attackReactions = cards.filter(c => c.isAttack && c.isReaction);
  const actionAttacks = cards.filter(c => c.isActionSupplier && c.isAttack);
  const drawAttacks = cards.filter(c => c.isDrawer && c.isAttack);
  
  // Cost-based lists for balanced kingdoms
  const cheapCards = cards.filter(c => cardCostValue(c) <= 3);
  const midCards = cards.filter(c => cardCostValue(c) === 4 || cardCostValue(c) === 5);
  const expensiveCards = cards.filter(c => cardCostValue(c) >= 6);
  
  // Group cards by expansion for two-expansion mode
  const cardsByExpansion = {};
  cards.forEach(card => {
    if (!cardsByExpansion[card.setId]) {
      cardsByExpansion[card.setId] = [];
    }
    cardsByExpansion[card.setId].push(card);
  });
  
  return {
    all: cards,
    actionSuppliers,
    drawers,
    attacks,
    reactions,
    durations,
    actionDrawers,
    attackReactions,
    actionAttacks,
    drawAttacks,
    byCode: new Map(cards.map(c => [c.id, c])),
    cheapCards,
    midCards,
    expensiveCards,
    cardsByExpansion
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
    requireAttack = false,
    requireReactionIfAttack = false,
    twoExpansionsOnly = false,
    lockedCards = []  // Array of card objects that must be included
  } = config;
  
  const targetSize = 10;
  const kingdom = [...lockedCards]; // Start with locked cards
  const usedIds = new Set(lockedCards.map(c => c.id));
  
  // Determine available card pool based on two-expansion mode
  let availableCards = cardLists.all;
  let selectedExpansions = null;
  
  if (twoExpansionsOnly && cardLists.cardsByExpansion) {
    // Get current expansions from locked cards (excluding promos)
    const currentExpansions = new Set();
    lockedCards.forEach(card => {
      if (card.setId !== 'promos') {
        currentExpansions.add(card.setId);
      }
    });
    
    // Get all available expansions (excluding promos)
    const allExpansions = Object.keys(cardLists.cardsByExpansion)
      .filter(exp => exp !== 'promos');
    
    if (currentExpansions.size >= 2) {
      // Already have 2+ expansions from locked cards, use those
      selectedExpansions = Array.from(currentExpansions).slice(0, 2);
    } else if (currentExpansions.size === 1) {
      // Have 1 expansion from locked cards, pick one more
      const currentExp = Array.from(currentExpansions)[0];
      const remainingExpansions = allExpansions.filter(exp => exp !== currentExp);
      if (remainingExpansions.length > 0) {
        const secondExp = shuffle(remainingExpansions)[0];
        selectedExpansions = [currentExp, secondExp];
      } else {
        // Only one expansion available, use it alone
        selectedExpansions = [currentExp];
      }
    } else {
      // No expansions from locked cards, pick 2 random ones
      if (allExpansions.length >= 2) {
        const shuffledExpansions = shuffle(allExpansions);
        selectedExpansions = [shuffledExpansions[0], shuffledExpansions[1]];
      } else if (allExpansions.length === 1) {
        selectedExpansions = [allExpansions[0]];
      }
    }
    
    if (selectedExpansions && selectedExpansions.length > 0) {
      console.log(`Two-expansion mode: ${selectedExpansions.join(' and ')}`);
      
      // Create pool from selected expansions plus promos
      availableCards = [];
      selectedExpansions.forEach(exp => {
        if (cardLists.cardsByExpansion[exp]) {
          availableCards.push(...cardLists.cardsByExpansion[exp]);
        }
      });
      
      // Always include promos if they exist
      if (cardLists.cardsByExpansion['promos']) {
        availableCards.push(...cardLists.cardsByExpansion['promos']);
      }
      
      // Update categorized lists to only include cards from these expansions
      const expansionIds = new Set(availableCards.map(c => c.id));
      cardLists = {
        ...cardLists,
        all: availableCards,
        actionSuppliers: cardLists.actionSuppliers.filter(c => expansionIds.has(c.id)),
        drawers: cardLists.drawers.filter(c => expansionIds.has(c.id)),
        attacks: cardLists.attacks.filter(c => expansionIds.has(c.id)),
        reactions: cardLists.reactions.filter(c => expansionIds.has(c.id)),
        actionDrawers: cardLists.actionDrawers.filter(c => expansionIds.has(c.id)),
        actionAttacks: cardLists.actionAttacks.filter(c => expansionIds.has(c.id)),
        drawAttacks: cardLists.drawAttacks.filter(c => expansionIds.has(c.id))
      };
    }
  }
  
  // Check if locked cards already satisfy requirements
  let needsActions = requireAccs && !kingdom.some(c => c.isActionSupplier);
  let needsDraw = requireDraw && !kingdom.some(c => c.isDrawer);
  let needsAttack = requireAttack && !kingdom.some(c => c.isAttack);
  let hasAttack = kingdom.some(c => c.isAttack) || requireAttack;
  let needsReaction = requireReactionIfAttack && hasAttack && !kingdom.some(c => c.isReaction);
  
  // Function to add a card if it's not already used
  const tryAddCard = (card) => {
    if (!usedIds.has(card.id)) {
      kingdom.push(card);
      usedIds.add(card.id);
      // Update reaction requirement if we just added an attack
      if (card.isAttack && requireReactionIfAttack && !kingdom.some(c => c.isReaction)) {
        needsReaction = true;
      }
      return true;
    }
    return false;
  };
  
  // Priority system: try to satisfy multiple requirements with single cards
  
  // 1. Try to find cards that satisfy 3+ requirements
  if ((needsActions + needsDraw + needsAttack) >= 2 && kingdom.length < targetSize) {
    // Look for cards that satisfy multiple needs
    let candidates = [];
    
    if (needsActions && needsDraw && needsAttack) {
      candidates = availableCards.filter(c => 
        c.isActionSupplier && c.isDrawer && c.isAttack && !usedIds.has(c.id)
      );
    }
    
    if (candidates.length === 0 && needsActions && needsAttack) {
      candidates = cardLists.actionAttacks.filter(c => !usedIds.has(c.id));
    }
    
    if (candidates.length === 0 && needsDraw && needsAttack) {
      candidates = cardLists.drawAttacks.filter(c => !usedIds.has(c.id));
    }
    
    if (candidates.length === 0 && needsActions && needsDraw) {
      candidates = cardLists.actionDrawers.filter(c => !usedIds.has(c.id));
    }
    
    if (candidates.length > 0) {
      const card = shuffle(candidates)[0];
      if (tryAddCard(card)) {
        if (card.isActionSupplier) needsActions = false;
        if (card.isDrawer) needsDraw = false;
        if (card.isAttack) needsAttack = false;
      }
    }
  }
  
  // 2. Satisfy remaining individual requirements
  if (needsAttack && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.attacks.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
      needsAttack = false;
    }
  }
  
  if (needsActions && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.actionSuppliers.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
      needsActions = false;
    }
  }
  
  if (needsDraw && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.drawers.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
      needsDraw = false;
    }
  }
  
  // 3. Check if we need a reaction (after potentially adding attacks)
  hasAttack = kingdom.some(c => c.isAttack);
  if (requireReactionIfAttack && hasAttack && !kingdom.some(c => c.isReaction) && kingdom.length < targetSize) {
    const candidates = shuffle(cardLists.reactions.filter(c => !usedIds.has(c.id)));
    if (candidates.length > 0) {
      tryAddCard(candidates[0]);
    }
  }
  
  // 4. Fill remaining slots randomly
  const remainingCards = shuffle(availableCards.filter(c => !usedIds.has(c.id)));
  while (kingdom.length < targetSize && remainingCards.length > 0) {
    const card = remainingCards.pop();
    tryAddCard(card);
  }
  
  // Sort by cost
  kingdom.sort((a, b) => cardCostValue(a) - cardCostValue(b));
  return kingdom;
}

// Reroll a single card while respecting requirements
export function rerollSingleCard(cardToReplace, currentKingdom, cardLists, config = {}) {
  const { 
    requireAccs = false, 
    requireDraw = false,
    requireAttack = false,
    requireReactionIfAttack = false,
    twoExpansionsOnly = false
  } = config;
  
  // Create a new kingdom without the card to replace
  const kingdomWithoutTarget = currentKingdom.filter(c => c.id !== cardToReplace.id);
  
  // If in two-expansion mode, limit candidates to existing expansions
  let availableCardLists = cardLists;
  if (twoExpansionsOnly) {
    // Get current expansions from kingdom (excluding promos and the card being replaced)
    const currentExpansions = new Set();
    kingdomWithoutTarget.forEach(card => {
      if (card.setId !== 'promos') {
        currentExpansions.add(card.setId);
      }
    });
    
    // If we have 2 or more expansions, limit to those
    if (currentExpansions.size >= 2) {
      const allowedExpansions = Array.from(currentExpansions).slice(0, 2);
      const allowedExpansionSet = new Set(allowedExpansions);
      allowedExpansionSet.add('promos'); // Always allow promos
      
      // Filter all card lists to only include allowed expansions
      const filterByExpansion = (cards) => cards.filter(c => allowedExpansionSet.has(c.setId));
      
      availableCardLists = {
        ...cardLists,
        all: filterByExpansion(cardLists.all),
        actionSuppliers: filterByExpansion(cardLists.actionSuppliers),
        drawers: filterByExpansion(cardLists.drawers),
        attacks: filterByExpansion(cardLists.attacks),
        reactions: filterByExpansion(cardLists.reactions),
        actionDrawers: filterByExpansion(cardLists.actionDrawers || []),
        actionAttacks: filterByExpansion(cardLists.actionAttacks || []),
        drawAttacks: filterByExpansion(cardLists.drawAttacks || [])
      };
      
      console.log(`Rerolling within expansions: ${allowedExpansions.join(', ')}`);
    }
    // If less than 2 expansions, allow any card (which might add a new expansion)
  }
  
  // Check if removing this card breaks any requirements
  const targetWasActionSupplier = cardToReplace.isActionSupplier;
  const targetWasDrawer = cardToReplace.isDrawer;
  const targetWasAttack = cardToReplace.isAttack;
  const targetWasReaction = cardToReplace.isReaction;
  
  const stillHasActions = kingdomWithoutTarget.some(c => c.isActionSupplier);
  const stillHasDraw = kingdomWithoutTarget.some(c => c.isDrawer);
  const stillHasAttack = kingdomWithoutTarget.some(c => c.isAttack);
  const stillHasReaction = kingdomWithoutTarget.some(c => c.isReaction);
  
  const needsActions = requireAccs && targetWasActionSupplier && !stillHasActions;
  const needsDraw = requireDraw && targetWasDrawer && !stillHasDraw;
  const needsAttack = requireAttack && targetWasAttack && !stillHasAttack;
  const needsReaction = requireReactionIfAttack && stillHasAttack && targetWasReaction && !stillHasReaction;
  
  // Get current kingdom card IDs to exclude
  const usedIds = new Set(kingdomWithoutTarget.map(c => c.id));
  
  // Build candidate pool based on requirements
  let candidates;
  const requirementCount = needsActions + needsDraw + needsAttack + needsReaction;
  
  if (requirementCount >= 2) {
    // Try to find cards that satisfy multiple requirements
    candidates = availableCardLists.all.filter(c => {
      if (usedIds.has(c.id)) return false;
      let satisfiedCount = 0;
      if (needsActions && c.isActionSupplier) satisfiedCount++;
      if (needsDraw && c.isDrawer) satisfiedCount++;
      if (needsAttack && c.isAttack) satisfiedCount++;
      if (needsReaction && c.isReaction) satisfiedCount++;
      return satisfiedCount >= 2;
    });
    
    // If no multi-requirement cards, fall back to most critical requirement
    if (candidates.length === 0) {
      if (needsAttack) {
        candidates = availableCardLists.attacks.filter(c => !usedIds.has(c.id));
      } else if (needsReaction) {
        candidates = availableCardLists.reactions.filter(c => !usedIds.has(c.id));
      } else if (needsActions) {
        candidates = availableCardLists.actionSuppliers.filter(c => !usedIds.has(c.id));
      } else if (needsDraw) {
        candidates = availableCardLists.drawers.filter(c => !usedIds.has(c.id));
      }
    }
  } else if (needsAttack) {
    candidates = availableCardLists.attacks.filter(c => !usedIds.has(c.id));
  } else if (needsReaction) {
    candidates = availableCardLists.reactions.filter(c => !usedIds.has(c.id));
  } else if (needsActions) {
    candidates = availableCardLists.actionSuppliers.filter(c => !usedIds.has(c.id));
  } else if (needsDraw) {
    candidates = availableCardLists.drawers.filter(c => !usedIds.has(c.id));
  } else {
    // No specific requirements, any card will do
    candidates = availableCardLists.all.filter(c => !usedIds.has(c.id));
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

function getApproachingArmyAttack(allCards, kingdom) {
  if (!Array.isArray(allCards) || !Array.isArray(kingdom)) return null;
  
  // Build a set of card IDs already in the kingdom for quick lookup
  const kingdomIds = new Set(kingdom.map(c => c.id));
  
  // Filter for attack cards not in the kingdom
  const candidates = allCards.filter(card =>
    card.isAttack && !kingdomIds.has(card.id)
  );
  
  if (candidates.length === 0) return null; // no valid attack cards
  
  // Pick a random one
  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

export function getBonusCards(cardPool, kingdom, events, projects, prophecies, othercards) {
  let event = false;
  let project = false;
  let doubleProject = false;
  let shelters = false;
  let platinum_colony = false;
  let river_boat = false;
  let prophecy = false;
  let approaching_army = false;

  for (const card of kingdom) {
    if (card.setId === 'renaissance' && Math.random() < 0.2) project = true;
    if (card.setId === 'renaissance' && Math.random() < 0.2 && project) doubleProject = true;
    if (card.setId === 'risingsun' && Math.random() < 0.2) event = true;
    if (card.setId === 'darkages' && Math.random() < 0.2) shelters = true;
    if (card.setId === 'prosperity' && Math.random() < 0.2) platinum_colony = true;
    if (card.name === 'Riverboat') river_boat = true;
    if (card.isOmen) prophecy = true;
  }

  const upbonuses = [];
  const sidebonuses = [];
  
  // Handle prophecy - check if it's Approaching Army
  if (prophecy) {
    const prophecyCard = getProphecyCard(prophecies);
    if (prophecyCard) {
      sidebonuses.push(prophecyCard);
      // Check if this is Approaching Army
      if (prophecyCard.name === 'Approaching Army' || prophecyCard.id === 'approachingarmy') {
        approaching_army = true;
      }
    }
  }
  
  if (shelters) upbonuses.push(...getShelterCards(othercards));
  if (platinum_colony) upbonuses.push(...getPlatinumCard(othercards));
  if (platinum_colony) upbonuses.push(...getColonyCard(othercards));
  
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
  
  // Add extra attack card if Approaching Army is active
  if (approaching_army) {
    const attackCard = getApproachingArmyAttack(cardPool, kingdom);
    if (attackCard) upbonuses.push(attackCard);
  }
  
  if (event) {
    const eventCard = getRandEventCard(events);
    if (eventCard) sidebonuses.push(eventCard);
  }

  return [upbonuses, sidebonuses];
}