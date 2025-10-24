// js/main.js
import { loadCards, getRandomKingdom, getBonusCards } from './modules/kingdom.js';
import { renderKingdom } from './modules/display.js';

// parse URL search params into boolean flags
function readParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    accs: p.get('accs') === 'true',
    draw: p.get('draw') === 'true',
    blacklist: p.get('blacklist') === 'true',
    baseOnly: p.get('baseOnly') === 'true'
  };
}

// set URL params and reload page
function writeParams(params) {
  const p = new URLSearchParams();
  if (params.accs) p.set('accs', 'true');
  if (params.draw) p.set('draw', 'true');
  if (params.blacklist) p.set('blacklist', 'true');
  if (params.baseOnly) p.set('baseOnly', 'true');
  window.location.search = p.toString();
}

document.addEventListener('DOMContentLoaded', async () => {
  const accsBox = document.getElementById('accs');
  const drawBox = document.getElementById('draw');
  const blacklistBox = document.getElementById('blacklist');
  const baseOnlyBox = document.getElementById('baseOnly');
  const generateBtn = document.getElementById('generate');
  const kingdomContainer = document.getElementById('kingdom-cards');

  // 1) read params, reflect in UI
  const params = readParams();
  accsBox.checked = params.accs;
  drawBox.checked = params.draw;
  blacklistBox.checked = params.blacklist;
  baseOnlyBox.checked = params.baseOnly;

  // 2) clicking "Generate" writes params and reloads
  generateBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    const newParams = {
      accs: accsBox.checked,
      draw: drawBox.checked,
      blacklist: blacklistBox.checked,
      baseOnly: baseOnlyBox.checked
    };
    writeParams(newParams);
  });

  // 3) load card data (cards of owned sets, applying blacklist if requested)
  const { cards, events, projects, prophecies, othercards } = await loadCards({ baseOnly: params.baseOnly, applyBlacklist: params.blacklist });
  
  // 4) generate kingdom according to params
  const kingdom = getRandomKingdom(cards, {
    requireAccs: params.accs,
    requireDraw: params.draw
  });

  // 5) generate bonus kingdom cards
  const [upbonuses, sidebonuses] = getBonusCards(cards, kingdom, events, projects, prophecies, othercards);
  
  // 6) render
  renderKingdom(kingdom, 'kingdom-cards', [upbonuses, sidebonuses]);
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.card')) {
    document.querySelectorAll('.card.active').forEach(card => {
      card.classList.remove('active');
    });
  }
});