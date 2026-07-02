// coords.js - hex axial coordinates for the 61-cell Abalone board (radius 4)
// Axial (q, r) with cube s = -q - r. Valid cells satisfy max(|q|,|r|,|s|) <= 4.

export const RADIUS = 4;

export function key(q, r) {
  return `${q},${r}`;
}

// Cheap allocation-free index for board arrays: q,r in [-4,4] map uniquely into
// [0,80]. Used instead of string keys in every hot search/eval path.
export function idx(q, r) {
  return (q + RADIUS) * 9 + (r + RADIUS);
}
export const BOARD_SIZE = 81;

export function isValidCell(q, r) {
  const s = -q - r;
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= RADIUS;
}

// All 61 valid cells, generated once.
export const ALL_CELLS = (() => {
  const cells = [];
  for (let r = -RADIUS; r <= RADIUS; r++) {
    const qMin = Math.max(-RADIUS, -RADIUS - r);
    const qMax = Math.min(RADIUS, RADIUS - r);
    for (let q = qMin; q <= qMax; q++) {
      cells.push({ q, r });
    }
  }
  return cells;
})();

// The 6 hex neighbor directions (axial). Opposite pairs sit 3 apart in this array.
export const DIRECTIONS = [
  { q: 1, r: 0, name: 'E' },
  { q: 1, r: -1, name: 'NE' },
  { q: 0, r: -1, name: 'NW' },
  { q: -1, r: 0, name: 'W' },
  { q: -1, r: 1, name: 'SW' },
  { q: 0, r: 1, name: 'SE' },
];

export function oppositeDir(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 3) % 6];
}

export function sameAxis(dirA, dirB) {
  return dirA === dirB || dirA === oppositeDir(dirB);
}

export function add(a, dir) {
  return { q: a.q + dir.q, r: a.r + dir.r };
}

export function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function distanceFromCenter(cell) {
  return hexDistance(cell, { q: 0, r: 0 });
}

// Pixel geometry for a pointy-top hex grid (Red Blob Games conventions).
export const HEX_SIZE = 32;

export function axialToPixel(q, r, size = HEX_SIZE) {
  return {
    x: size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: size * 1.5 * r,
  };
}

export function hexCorners(cx, cy, size = HEX_SIZE) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    points.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return points;
}

// Standard Abalone notation: rows A-I (r = -4..4), columns 1-9.
export function toNotation({ q, r }) {
  const qMin = Math.max(-RADIUS, -RADIUS - r);
  const start = r <= 0 ? 1 : 1 + r;
  const col = start + (q - qMin);
  const letter = 'ABCDEFGHI'[r + RADIUS];
  return `${letter}${col}`;
}
