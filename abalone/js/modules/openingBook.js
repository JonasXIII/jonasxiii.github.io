// openingBook.js - "good opening moves" toggle. Rather than a hardcoded table of
// memorized lines (which would be fragile and unverifiable), this applies real
// opening principles - centralize, stay off the edge, stay cohesive - as a cheap
// single-ply evaluation for the first few moves of the game, skipping full search
// entirely. It's faster than search AND embodies known-good Abalone opening ideas.
import { getLegalMoves, applyMove } from './engine.js';
import { evaluate } from './heuristics.js';

export const BOOK_PLY_LIMIT = 4; // first two moves per side

const BOOK_AI_CONFIG = {
  heuristics: {
    centerControl: { enabled: true, weight: 6 },
    edgeExposure: { enabled: true, weight: 5 },
    cohesion: { enabled: true, weight: 2 },
  },
};

export function isBookPly(plyIndex) {
  return plyIndex < BOOK_PLY_LIMIT;
}

export function bookMove(board, color) {
  const moves = getLegalMoves(board, color);
  if (moves.length === 0) return null;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = evaluate(applyMove(board, move), color, BOOK_AI_CONFIG);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
