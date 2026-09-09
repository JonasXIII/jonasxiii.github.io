// js/modules/intro.js - first-visit welcome modal + on-demand help button.
// Shows automatically once (tracked in localStorage), and the "?" button
// reopens it any time. Unrelated to card generation - the Generate/reroll/
// lock buttons never touch this.
const SEEN_KEY = 'dominion-intro-seen';

export function initIntro() {
  const modal = document.getElementById('intro-modal');
  const closeBtn = document.getElementById('intro-close');
  const gotItBtn = document.getElementById('intro-got-it');
  const helpBtn = document.getElementById('help-btn');
  if (!modal || !helpBtn) return;

  const open = () => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    try { localStorage.setItem(SEEN_KEY, 'true'); } catch (e) { /* private browsing, etc. */ }
  };

  closeBtn.addEventListener('click', close);
  gotItBtn.addEventListener('click', close);
  helpBtn.addEventListener('click', open);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });

  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === 'true'; } catch (e) { /* ignore */ }
  if (!seen) open();
}
