// render.js - draws the board as SVG. Pure presentation: main.js decides what's
// selected/highlighted/clickable, this module just turns that into markup.
import { ALL_CELLS, key, axialToPixel, hexCorners, HEX_SIZE } from './coords.js';
import { getAt } from './engine.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// ui: { selected: Set<string>, legalTargets: Set<string>, lastMove: Set<string>,
//       clickable: Set<string>, onCellClick: (cell) => void }
export function renderBoard(svg, board, ui = {}) {
  const selected = ui.selected || new Set();
  const legalTargets = ui.legalTargets || new Set();
  const lastMove = ui.lastMove || new Set();
  const clickable = ui.clickable || new Set();

  while (svg.firstChild) svg.removeChild(svg.firstChild);

  for (const cell of ALL_CELLS) {
    const k = key(cell.q, cell.r);
    const { x, y } = axialToPixel(cell.q, cell.r);
    const classes = ['hex-cell'];
    if (selected.has(k)) classes.push('selected');
    if (legalTargets.has(k)) classes.push('legal-move');
    if (lastMove.has(k)) classes.push('last-move');
    if (clickable.has(k)) classes.push('selectable');

    const points = hexCorners(x, y).map((p) => p.join(',')).join(' ');
    const poly = makeEl('polygon', { points, class: classes.join(' ') });
    if (clickable.has(k) && ui.onCellClick) {
      poly.addEventListener('click', () => ui.onCellClick(cell));
    }
    svg.appendChild(poly);

    const color = getAt(board, cell);
    if (color === 'b' || color === 'w') {
      const marble = makeEl('circle', {
        cx: x,
        cy: y,
        r: HEX_SIZE * 0.62,
        class: `marble marble-${color === 'b' ? 'black' : 'white'}`,
      });
      svg.appendChild(marble);
      if (clickable.has(k) && ui.onCellClick) {
        marble.style.pointerEvents = 'auto';
        marble.style.cursor = 'pointer';
        marble.addEventListener('click', () => ui.onCellClick(cell));
      }
    }
  }
}
