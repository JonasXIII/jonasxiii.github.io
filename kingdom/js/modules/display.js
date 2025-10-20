// js/modules/display.js

export function renderKingdom(kingdom, container = null) {
  // accept either a DOM element or an id string
  let target;
  if (!container) target = document.getElementById('cards');
  else if (typeof container === 'string') target = document.getElementById(container);
  else target = container;

  if (!target) {
    console.error('renderKingdom: no container found');
    return;
  }
  target.innerHTML = ''; 

  kingdom.forEach(card => {
    const wrapper = document.createElement('div');
    wrapper.className = 'card';

    const img = document.createElement('img');
    // prefer jpg but try png if jpg 404s
    const jpgPath = `./data/dominion_card_imgs/${card.setId}/${card.id}.jpg`;
    img.src = jpgPath;
    img.alt = card.name || card.id || 'card';


    // caption shows setId (as you requested earlier)
    const caption = document.createElement('div');
    caption.className = 'caption';
    caption.textContent = card.setId || '';

    wrapper.appendChild(img);
    wrapper.appendChild(caption);
    target.appendChild(wrapper);
  });
}
