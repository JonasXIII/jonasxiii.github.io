export function renderKingdom(kingdom, kingdomContainer = 'kingdom-cards', bonusTuple = [[], []]) {
  const [upbonuses, sidebonuses] = bonusTuple;

  const kingdomEl = document.getElementById(kingdomContainer);
  const upEl = document.getElementById('bonus-upright');
  const sideEl = document.getElementById('bonus-sideways');

  if (!kingdomEl || !upEl || !sideEl) {
    console.error('Missing render containers');
    return;
  }

  kingdomEl.innerHTML = '';
  upEl.innerHTML = '';
  sideEl.innerHTML = '';

  // Helper to create a card element
  const createCard = (card, sideways = false) => {
    const el = document.createElement('div');
    el.className = 'card' + (sideways ? ' sideways' : '');
    const img = document.createElement('img');
    img.src = `./data/dominion_card_imgs/${card.setId}/${card.id}.jpg`;
    img.alt = card.name || card.id;
    el.appendChild(img);
    return el;
  };

  // Render kingdom (upright)
  kingdom.forEach(c => kingdomEl.appendChild(createCard(c)));

  // Render upright bonuses
  upbonuses.forEach(c => upEl.appendChild(createCard(c)));

  // Render sideways bonuses
  sidebonuses.forEach(c => sideEl.appendChild(createCard(c, true)));
}