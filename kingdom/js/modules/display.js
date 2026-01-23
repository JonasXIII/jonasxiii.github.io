// js/modules/display.js - Display and UI interaction module

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
    el.dataset.cardName = card.name || card.id;
    el.dataset.cardSet = card.setId;
    
    const img = document.createElement('img');
    img.src = `./data/dominion_card_imgs/${card.setId}/${card.id}.jpg`;
    img.alt = card.name || card.id;
    img.onerror = function() {
      // Fallback for missing images
      this.style.display = 'none';
      const placeholder = document.createElement('div');
      placeholder.style.cssText = 'width:100%;height:200px;background:#ddd;display:flex;align-items:center;justify-content:center;color:#666;font-size:14px;text-align:center;padding:10px;';
      placeholder.textContent = card.name || card.id;
      el.insertBefore(placeholder, el.firstChild);
    };
    
    // Create overlay with controls
    const overlay = document.createElement('div');
    overlay.className = 'card-overlay';
    
    // Card name display
    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'card-name';
    nameDisplay.textContent = card.name || card.id;
    
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
      
      const isLocking = el.classList.contains('locked');
      
      // Call the handler from main.js
      if (window.dominionHandlers && window.dominionHandlers.handleCardLock) {
        window.dominionHandlers.handleCardLock(card.id, isLocking);
      }
      
      // Update lock button appearance
      if (isLocking) {
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
      
      // Call the handler from main.js
      if (window.dominionHandlers && window.dominionHandlers.handleCardReroll) {
        window.dominionHandlers.handleCardReroll(card.id);
      }
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