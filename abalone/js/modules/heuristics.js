// heuristics.js - individual position-scoring components. Each is independently
// toggleable and weighted from the UI so the user can see how each idea affects play.
import { ALL_CELLS, DIRECTIONS, RADIUS, distanceFromCenter } from './coords.js';
import { getAt, countColor, opponent, getLegalMoves } from './engine.js';

const CANONICAL_AXES = DIRECTIONS.slice(0, 3); // E, NE, NW - same convention as engine.js

function sumInverseDistance(board, color) {
  let s = 0;
  for (const c of ALL_CELLS) if (getAt(board, c) === color) s += RADIUS - distanceFromCenter(c);
  return s;
}

function sumFriendlyNeighbors(board, color) {
  let s = 0;
  for (const c of ALL_CELLS) {
    if (getAt(board, c) !== color) continue;
    for (const d of DIRECTIONS) {
      if (getAt(board, { q: c.q + d.q, r: c.r + d.r }) === color) s++;
    }
  }
  return s;
}

function countOnEdge(board, color) {
  let n = 0;
  for (const c of ALL_CELLS) if (getAt(board, c) === color && distanceFromCenter(c) === RADIUS) n++;
  return n;
}

// Lighter-weight than engine.getGroups() (no group-object allocation, no dedup
// set) since this only needs to count, and it runs at every evaluated leaf.
function countTriples(board, color) {
  let count = 0;
  for (const cell of ALL_CELLS) {
    if (getAt(board, cell) !== color) continue;
    for (const axis of CANONICAL_AXES) {
      const c1 = { q: cell.q + axis.q, r: cell.r + axis.r };
      if (getAt(board, c1) !== color) continue;
      const c2 = { q: c1.q + axis.q, r: c1.r + axis.r };
      if (getAt(board, c2) === color) count++;
    }
  }
  return count;
}

export const HEURISTICS = {
  marbleDiff: {
    key: 'marbleDiff',
    label: 'Marble differential',
    description: 'Own marbles remaining minus opponent marbles remaining - the most direct proxy for the win condition.',
    defaultWeight: 100,
    defaultEnabled: true,
    compute: (board, color) => countColor(board, color) - countColor(board, opponent(color)),
  },
  centerControl: {
    key: 'centerControl',
    label: 'Center control',
    description: 'Rewards keeping marbles close to the center, where they are harder to push off and threaten more directions.',
    defaultWeight: 6,
    defaultEnabled: true,
    compute: (board, color) => sumInverseDistance(board, color) - sumInverseDistance(board, opponent(color)),
  },
  cohesion: {
    key: 'cohesion',
    label: 'Cohesion',
    description: 'Rewards marbles staying grouped with same-color neighbors; isolated marbles are easy sumito targets.',
    defaultWeight: 4,
    defaultEnabled: true,
    compute: (board, color) => sumFriendlyNeighbors(board, color) - sumFriendlyNeighbors(board, opponent(color)),
  },
  mobility: {
    key: 'mobility',
    label: 'Mobility',
    description: 'Rewards having more legal moves available. The most expensive heuristic to compute - toggling it off noticeably speeds up deep searches.',
    defaultWeight: 2,
    defaultEnabled: false,
    compute: (board, color) => getLegalMoves(board, color).length - getLegalMoves(board, opponent(color)).length,
  },
  edgeExposure: {
    key: 'edgeExposure',
    label: 'Edge safety',
    description: 'Penalizes marbles sitting on the outer ring, where a single push can send them off the board.',
    defaultWeight: 5,
    defaultEnabled: true,
    compute: (board, color) => -(countOnEdge(board, color) - countOnEdge(board, opponent(color))),
  },
  tripleFormation: {
    key: 'tripleFormation',
    label: 'Triple formations',
    description: 'Rewards having 3-in-a-row groups, the strongest possible pushing formation (3v1 / 3v2 sumito).',
    defaultWeight: 3,
    defaultEnabled: true,
    compute: (board, color) => countTriples(board, color) - countTriples(board, opponent(color)),
  },
};

export function defaultHeuristicConfig() {
  const config = {};
  for (const h of Object.values(HEURISTICS)) {
    config[h.key] = { enabled: h.defaultEnabled, weight: h.defaultWeight };
  }
  return config;
}

export function evaluate(board, color, aiConfig) {
  let score = 0;
  for (const h of Object.values(HEURISTICS)) {
    const cfg = aiConfig.heuristics[h.key];
    if (!cfg || !cfg.enabled) continue;
    score += cfg.weight * h.compute(board, color);
  }
  return score;
}
