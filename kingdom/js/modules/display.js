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
    
    // Store card data as attributes for later use
    el.dataset.cardId = card.id;
    el.dataset.cardName = card.name;
    el.dataset.cardSet = card.setId;
    
    const img = document.createElement('img');
    img.src = `./data/dominion_card_imgs/${card.setId}/${card.id}.jpg`;
    img.alt = card.name || card.id;
    
    // Create overlay with controls
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    
    // Card name display
    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'card-name';
    nameDisplay.textContent = card.setId || card.id;
    
    // Control buttons container
    const controls = document.createElement('div');
    controls.className = 'card-controls';
    
    // Lock button
    const lockBtn = document.createElement('button');
    lockBtn.className = 'card-btn lock-btn';
    lockBtn.innerHTML = '🔒';
    lockBtn.title = 'Lock this card';
    
    // Reroll button
    const rerollBtn = document.createElement('button');
    rerollBtn.className = 'card-btn reroll-btn';
    rerollBtn.innerHTML = '🔄';
    rerollBtn.title = 'Reroll this card';
    
    // Assemble the card
    controls.appendChild(lockBtn);
    controls.appendChild(rerollBtn);
    overlay.appendChild(nameDisplay);
    overlay.appendChild(controls);
    
    el.appendChild(img);
    el.appendChild(overlay);
    
    // Add click event to show/hide overlay
    el.addEventListener('click', (e) => {
      // Don't trigger if clicking on buttons
      if (!e.target.classList.contains('card-btn')) {
        // Close any other active cards
        document.querySelectorAll('.card.active').forEach(otherCard => {
          if (otherCard !== el) otherCard.classList.remove('active');
        });
        
        // Toggle this card's active state
        el.classList.toggle('active');
      }
    });
    
    // Lock button functionality
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click event
      el.classList.toggle('locked');
      
      // Update lock button appearance
      if (el.classList.contains('locked')) {
        lockBtn.innerHTML = '🔓';
        lockBtn.title = 'Unlock this card';
        console.log(`Locked card: ${card.name || card.id}`);
      } else {
        lockBtn.innerHTML = '🔒';
        lockBtn.title = 'Lock this card';
        console.log(`Unlocked card: ${card.name || card.id}`);
      }
    });
    
    // Reroll button functionality
    rerollBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent card click event
      console.log(`Reroll requested for: ${card.name || card.id}`);
      
      // In a real implementation, this would call a function to replace this card
      // For now, we'll just show a visual effect and log the action
      el.style.opacity = '0.7';
      setTimeout(() => {
        el.style.opacity = '1';
      }, 300);
      
      // You would implement actual reroll logic here
      alert(`Reroll functionality for ${card.name || card.id} would be implemented here!`);
    });
    
    return el;
  };

  // Render kingdom (upright)
  kingdom.forEach(c => kingdomEl.appendChild(createCard(c)));

  // Render upright bonuses
  upbonuses.forEach(c => upEl.appendChild(createCard(c)));

  // Render sideways bonuses
  sidebonuses.forEach(c => sideEl.appendChild(createCard(c, true)));
}