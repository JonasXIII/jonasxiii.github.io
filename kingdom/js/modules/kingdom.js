// js/modules/kingdom.js

// load dominion cards, owned sets and blacklist
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
    if (!mysets[setId]) continue; // skip sets the player doesn’t own
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

function cardMeetsRequirement(card, requirement) {
  switch (requirement) {
    case 'accs': return !!card.isActionSupplier;
    case 'draw': return !!card.isDrawer;
    default: return false;
  }
}

export function getRandomKingdom(cardsPool, config = {}) {
  const count = 10;
  if (!Array.isArray(cardsPool) || cardsPool.length === 0) return [];

  // If pool smaller than requested, return entire pool (sorted)
  if (cardsPool.length <= count) {
    return cardsPool.slice().sort((a, b) => cardCostValue(a) - cardCostValue(b));
  }

  // Determine which requirements are active
  const activeRequirements = [];
  if (config.requireAccs) activeRequirements.push('accs');
  if (config.requireDraw) activeRequirements.push('draw');

  // If no requirements, just return a random sorted selection
  if (activeRequirements.length === 0) {
    return shuffle(cardsPool).slice(0, count).sort((a, b) => cardCostValue(a) - cardCostValue(b));
  }

  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = shuffle(cardsPool).slice(0, 10);
    
    // Check if all requirements are met
    const requirementsMet = activeRequirements.every(req => 
      candidate.some(card => cardMeetsRequirement(card, req))
    );

    if (requirementsMet) {
      candidate.sort((a, b) => cardCostValue(a) - cardCostValue(b));
      return candidate;
    }
  }

  // If we couldn't satisfy requirements after all attempts, return best-effort
  console.warn('Could not satisfy requirements after attempts; returning best-effort.');
  const fallback = shuffle(cardsPool).slice(0, count);
  fallback.sort((a, b) => cardCostValue(a) - cardCostValue(b));
  return fallback;
}

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

  // Build a set of card IDs already in the kingdom for quick lookup
  const kingdomIds = new Set(kingdom.map(c => c.id));

  // Filter for eligible cards
  const candidates = allCards.filter(card =>
    card.cost?.treasure === 5 &&  // costs exactly 5
    !card.isDuration &&           // not a duration card
    !kingdomIds.has(card.id)      // not already in the kingdom
  );

  if (candidates.length === 0) return null; // no valid cards

  // Pick a random one
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