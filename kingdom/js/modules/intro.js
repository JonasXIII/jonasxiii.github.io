// js/modules/intro.js - the "what is this?" explainer.
//
// Built on a native <dialog>, which gives us the focus trap, Escape
// handling and focus-restore for free. Two open modes:
//
//   first visit  -> show()      non-modal, sits in the page flow under the
//                               header. The nav, the settings and Generate
//                               are all usable with it still on screen.
//   "?" button   -> showModal() modal, because the reader asked for it and
//                               nothing else on the page matters until they
//                               are done reading.
//
// Unrelated to card generation - the Generate/reroll/lock buttons never
// touch this.
const SEEN_KEY = 'dominion-intro-seen';

export function initIntro() {
  const dialog = document.getElementById('intro-modal');
  const helpBtn = document.getElementById('help-btn');
  if (!dialog || !helpBtn || typeof dialog.showModal !== 'function') return;

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, 'true');
    } catch (e) {
      /* private browsing, etc. */
    }
  };

  dialog.addEventListener('close', markSeen);
  document.getElementById('intro-close').addEventListener('click', () => dialog.close());
  document.getElementById('intro-got-it').addEventListener('click', () => dialog.close());
  helpBtn.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
  });

  // Click the backdrop to dismiss. The backdrop is part of the <dialog>
  // element's own box, so a click landing on the element itself (rather
  // than any child) means the reader clicked outside the panel.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Escape is built in for showModal() only, so the non-modal first-visit
  // panel needs it wired up by hand.
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dialog.matches(':modal')) {
      e.preventDefault();
      dialog.close();
    }
  });

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN_KEY) === 'true';
  } catch (e) {
    /* ignore */
  }
  if (!seen) dialog.show();
}
