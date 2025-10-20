// js/modules/kingdom.js

// load dominion cards, owned sets and blacklist
export async function loadCards(options = {}){
  const {baseOnly = false, applyBlacklist = false} = options;

  const [cardsRes, setsRes, blacklistRes] = await Promise.all([
    fetch('./data/dominion_cards.json'),
    fetch('./data/mysets.json'),
    fetch('./data/blacklist.json')
  ]);

  if (!cardsRes.ok) throw new Error('Failed loading dominion_cards.json');
  if (!setsRes.ok) throw new Error('Failed loading mysets.json');
  if (!blacklistRes.ok) console.warn('no blacklist.json found; continuing with empty blacklist');


  const cardsData = await cardsRes.json();
  const mysets = await setsRes.json();
  const blacklist = blacklistRes.ok ? await blacklistRes.json() : [];

  const all = [];
  for (const [setId, setInfo] of Object.entries(cardsData)) {
    if (mysets[setId]) {
      if (baseOnly && setId !== 'baseset2') continue;
      if (Array.isArray(setInfo.cards)) {
        for (const c of setInfo.cards) {
          if (applyBlacklist && blacklist.includes(c.id)) continue;
          all.push({ ...c, setId });
        }
      }
    }
  }

  return all;
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

export function getBonusCards(cardPool) {
  const event = false;
  const project = false;
  const doubleProject = false;
  const shelters = false;
  const platinum = false;
  const colony = false;
  const river_boat = false;
  const prophecy = false;

  for (const card of cardPool) {
    if (card.setId === 'renaissance' && Math.random() < 0.2) project = true;
    if (card.setId === 'renaissance' && Math.random() < 0.2 && project) doubleProject = true;
    if (card.setId === 'risingsun' && Math.random() < 0.2) event = true;
    if (card.setId === 'darkages' && Math.random() < 0.2) shelters = true;
    if (card.setId === 'prosperity' && Math.random() < 0.2) platinum = true;
    if (card.setId === 'prosperity' && Math.random() < 0.2) colony = true;
    if (card.name === 'Riverboat') river_boat = true;
    if (card.isOmen) prophecy = true;
  }

  const bonuses = [];
  



  return [];
}