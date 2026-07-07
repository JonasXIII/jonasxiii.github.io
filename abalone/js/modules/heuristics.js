// heuristics.js - individual position-scoring components. Each is independently
// toggleable and weighted from the UI so the user can see how each idea affects play.
//
// Performance note: evaluate() runs at every leaf node of the search, so it's
// the dominant per-move cost. Five of the six heuristics (all but mobility)
// are fused into one board scan (computeRawHeuristics) instead of each doing
// its own full pass - same numbers, far fewer board reads. The two expensive
// per-cell checks (same-color neighbors for cohesion, forward-axis triples)
// are only done when those specific heuristics are enabled.
import { ALL_CELLS, DIRECTIONS, RADIUS, distanceFromCenter } from './coords.js';
import { getAt, opponent, getLegalMoves } from './engine.js';

const CANONICAL_AXES = DIRECTIONS.slice(0, 3); // E, NE, NW - same convention as engine.js

// Raw (non-differential, non-weighted) per-color totals for both sides in a
// single pass. { b: {marbleDiff, centerControl, cohesion, edgeExposure, tripleFormation}, w: {...} }
// (the "Diff"/"Exposure"/"Formation" names match HEURISTICS keys but hold raw
// per-side counts here - evaluate() turns them into own-minus-opponent below.)
export function computeRawHeuristics(board, { needCohesion = true, needTriples = true } = {}) {
  const raw = {
    b: { marbleDiff: 0, centerControl: 0, cohesion: 0, edgeExposure: 0, tripleFormation: 0 },
    w: { marbleDiff: 0, centerControl: 0, cohesion: 0, edgeExposure: 0, tripleFormation: 0 },
  };

  for (const cell of ALL_CELLS) {
    const color = getAt(board, cell);
    if (color !== 'b' && color !== 'w') continue;
    const side = raw[color];
    const dist = distanceFromCenter(cell);

    side.marbleDiff += 1;
    side.centerControl += RADIUS - dist;
    if (dist === RADIUS) side.edgeExposure += 1;

    if (needCohesion) {
      for (const d of DIRECTIONS) {
        if (getAt(board, { q: cell.q + d.q, r: cell.r + d.r }) === color) side.cohesion += 1;
      }
    }

    if (needTriples) {
      for (const axis of CANONICAL_AXES) {
        const c1 = { q: cell.q + axis.q, r: cell.r + axis.r };
        if (getAt(board, c1) !== color) continue;
        const c2 = { q: c1.q + axis.q, r: c1.r + axis.r };
        if (getAt(board, c2) === color) side.tripleFormation += 1;
      }
    }
  }

  return raw;
}

export const HEURISTICS = {
  marbleDiff: {
    key: 'marbleDiff',
    label: 'Marble differential',
    description: 'Own marbles remaining minus opponent marbles remaining - the most direct proxy for the win condition.',
    defaultWeight: 100,
    defaultEnabled: true,
  },
  centerControl: {
    key: 'centerControl',
    label: 'Center control',
    description: 'Rewards keeping marbles close to the center, where they are harder to push off and threaten more directions.',
    defaultWeight: 6,
    defaultEnabled: true,
  },
  cohesion: {
    key: 'cohesion',
    label: 'Cohesion',
    description: 'Rewards marbles staying grouped with same-color neighbors; isolated marbles are easy sumito targets.',
    defaultWeight: 4,
    defaultEnabled: true,
  },
  mobility: {
    key: 'mobility',
    label: 'Mobility',
    description: 'Rewards having more legal moves available. The most expensive heuristic to compute - toggling it off noticeably speeds up deep searches.',
    defaultWeight: 2,
    defaultEnabled: false,
  },
  edgeExposure: {
    key: 'edgeExposure',
    label: 'Edge safety',
    description: 'Penalizes marbles sitting on the outer ring, where a single push can send them off the board.',
    defaultWeight: 5,
    defaultEnabled: true,
  },
  tripleFormation: {
    key: 'tripleFormation',
    label: 'Triple formations',
    description: 'Rewards having 3-in-a-row groups, the strongest possible pushing formation (3v1 / 3v2 sumito).',
    defaultWeight: 3,
    defaultEnabled: true,
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
  const h = aiConfig.heuristics;
  const opp = opponent(color);
  let score = 0;

  const needCohesion = !!h.cohesion?.enabled;
  const needTriples = !!h.tripleFormation?.enabled;
  const needScan = h.marbleDiff?.enabled || h.centerControl?.enabled || h.edgeExposure?.enabled || needCohesion || needTriples;

  if (needScan) {
    const raw = computeRawHeuristics(board, { needCohesion, needTriples });
    const own = raw[color];
    const rival = raw[opp];
    if (h.marbleDiff?.enabled) score += h.marbleDiff.weight * (own.marbleDiff - rival.marbleDiff);
    if (h.centerControl?.enabled) score += h.centerControl.weight * (own.centerControl - rival.centerControl);
    if (needCohesion) score += h.cohesion.weight * (own.cohesion - rival.cohesion);
    if (h.edgeExposure?.enabled) score += h.edgeExposure.weight * -(own.edgeExposure - rival.edgeExposure);
    if (needTriples) score += h.tripleFormation.weight * (own.tripleFormation - rival.tripleFormation);
  }

  if (h.mobility?.enabled) {
    score += h.mobility.weight * (getLegalMoves(board, color).length - getLegalMoves(board, opp).length);
  }

  return score;
}
