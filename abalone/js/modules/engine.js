// engine.js - Abalone rules: board setup, move generation, move application, win detection.
// No DOM dependency - runnable standalone in Node for sanity checks.
import { ALL_CELLS, DIRECTIONS, RADIUS, BOARD_SIZE, key, idx, add, isValidCell, sameAxis, toNotation } from './coords.js';

export function opponent(color) {
  return color === 'b' ? 'w' : 'b';
}

// Boards are plain arrays of length BOARD_SIZE indexed via coords.idx(q,r) -
// integer array indexing instead of string-keyed lookups, since getAt() is
// called millions of times during a deep search and string allocation there
// dominated profiling.
export function getAt(board, cell) {
  const v = board[idx(cell.q, cell.r)];
  return v === undefined ? null : v;
}

function setRow(board, r, color, mode) {
  const qMin = Math.max(-RADIUS, -RADIUS - r);
  const qMax = Math.min(RADIUS, RADIUS - r);
  const width = qMax - qMin + 1;
  if (mode === 'all') {
    for (let q = qMin; q <= qMax; q++) board[idx(q, r)] = color;
  } else {
    const startK = Math.floor((width - 3) / 2);
    for (let k = startK; k < startK + 3; k++) board[idx(qMin + k, r)] = color;
  }
}

export function createInitialBoard() {
  const board = new Array(BOARD_SIZE);
  for (const c of ALL_CELLS) board[idx(c.q, c.r)] = 'e';
  setRow(board, 4, 'w', 'all');
  setRow(board, 3, 'w', 'all');
  setRow(board, 2, 'w', 'middle3');
  setRow(board, -4, 'b', 'all');
  setRow(board, -3, 'b', 'all');
  setRow(board, -2, 'b', 'middle3');
  return board;
}

// All unique contiguous same-color groups of length 1-3, found by walking from
// every occupied cell along each of the 3 canonical axes (their opposites are
// covered implicitly since a group's cell set is the same regardless of which
// end you start scanning from).
const CANONICAL_AXES = DIRECTIONS.slice(0, 3); // E, NE, NW

export function getGroups(board, color) {
  const seen = new Set();
  const groups = [];
  for (const cell of ALL_CELLS) {
    if (getAt(board, cell) !== color) continue;
    for (const axis of CANONICAL_AXES) {
      const chain = [cell];
      let cur = cell;
      for (let step = 0; step < 2; step++) {
        const next = add(cur, axis);
        if (!isValidCell(next.q, next.r) || getAt(board, next) !== color) break;
        chain.push(next);
        cur = next;
      }
      for (let len = 1; len <= chain.length; len++) {
        const g = chain.slice(0, len);
        const sig = g.map((c) => idx(c.q, c.r)).sort((a, b) => a - b).join(',');
        if (!seen.has(sig)) {
          seen.add(sig);
          groups.push({ cells: g, axis: len > 1 ? axis : null });
        }
      }
    }
  }
  return groups;
}

function groupHead(group, dir) {
  const groupIdx = new Set(group.cells.map((c) => idx(c.q, c.r)));
  return group.cells.find((c) => !groupIdx.has(idx(c.q + dir.q, c.r + dir.r)));
}

function tryInlineMove(board, group, dir, color) {
  const head = groupHead(group, dir);
  const destHead = add(head, dir);
  if (!isValidCell(destHead.q, destHead.r)) return null;
  const destColor = getAt(board, destHead);
  if (destColor === color) return null;

  let captures = [];
  let pushedFrom = [];
  if (destColor === 'e') {
    // simple slide, nothing to push
  } else {
    // destColor is the opponent's - attempt sumito
    if (group.cells.length === 1) return null; // a lone marble can never push
    const oppCells = [];
    let cur = destHead;
    while (isValidCell(cur.q, cur.r) && getAt(board, cur) === opponent(color)) {
      oppCells.push(cur);
      cur = add(cur, dir);
    }
    if (oppCells.length === 0 || oppCells.length >= group.cells.length) return null; // must outnumber
    if (oppCells.length > 2) return null; // max sumito is 3v2
    if (!isValidCell(cur.q, cur.r)) {
      captures = [oppCells[oppCells.length - 1]];
      pushedFrom = oppCells.slice(0, -1);
    } else {
      if (getAt(board, cur) !== 'e') return null; // blocked beyond
      pushedFrom = oppCells;
    }
  }

  return {
    color,
    type: 'inline',
    dir,
    from: group.cells.map((c) => ({ ...c })),
    to: group.cells.map((c) => add(c, dir)),
    pushedFrom: pushedFrom.map((c) => ({ ...c })),
    pushedTo: pushedFrom.map((c) => add(c, dir)),
    captures: captures.map((c) => ({ ...c })),
  };
}

function tryBroadsideMove(board, group, dir, color) {
  const destCells = group.cells.map((c) => add(c, dir));
  for (const d of destCells) {
    if (!isValidCell(d.q, d.r) || getAt(board, d) !== 'e') return null;
  }
  return {
    color,
    type: 'broadside',
    dir,
    from: group.cells.map((c) => ({ ...c })),
    to: destCells,
    pushedFrom: [],
    pushedTo: [],
    captures: [],
  };
}

export function getLegalMoves(board, color) {
  const moves = [];
  for (const group of getGroups(board, color)) {
    for (const dir of DIRECTIONS) {
      const inline = group.axis === null || sameAxis(dir, group.axis);
      const move = inline
        ? tryInlineMove(board, group, dir, color)
        : tryBroadsideMove(board, group, dir, color);
      if (move) moves.push(move);
    }
  }
  return moves;
}

export function applyMove(board, move) {
  const newBoard = board.slice();
  for (const c of move.from) newBoard[idx(c.q, c.r)] = 'e';
  for (const c of move.pushedFrom) newBoard[idx(c.q, c.r)] = 'e';
  for (const c of move.captures) newBoard[idx(c.q, c.r)] = 'e';
  for (const c of move.to) newBoard[idx(c.q, c.r)] = move.color;
  const oppColor = opponent(move.color);
  for (const c of move.pushedTo) newBoard[idx(c.q, c.r)] = oppColor;
  return newBoard;
}

export function countColor(board, color) {
  let n = 0;
  for (const c of ALL_CELLS) if (getAt(board, c) === color) n++;
  return n;
}

// Returns the winning color, or null if the game continues.
export function checkWin(board) {
  if (14 - countColor(board, 'b') >= 6) return 'w';
  if (14 - countColor(board, 'w') >= 6) return 'b';
  return null;
}

export function moveNotation(move) {
  const from = [...move.from].sort((a, b) => a.q - b.q || a.r - b.r).map(toNotation).join(',');
  const to = [...move.to].sort((a, b) => a.q - b.q || a.r - b.r).map(toNotation).join(',');
  return `${from}→${to}`;
}
