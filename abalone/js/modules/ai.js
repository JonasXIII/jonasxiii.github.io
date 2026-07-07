// ai.js - negamax search with a toggleable alpha-beta prune, depth-limited by
// the user's "lookahead" setting, with optional transposition-table caching
// and an optional opening-book shortcut for the first few plies.
//
// When alpha-beta AND caching are both on, three classic branch-reduction
// techniques kick in together (each depends on the transposition table, so
// they're naturally gated on caching being available):
//   - Iterative deepening: search depth 1, 2, 3... up to the target depth,
//     reusing each pass's best move (via the TT) to seed move ordering at
//     the next depth. The shallow re-searches are cheap; the ordering payoff
//     from already knowing a probably-good move causes far more cutoffs.
//   - Killer moves: a quiet (non-capture) move that caused a cutoff at a
//     given depth is tried first in *sibling* branches at that same depth,
//     since the same tactical shape often recurs across the tree.
//   - Principal Variation Search: once ordering is good, every move after
//     the first is probed with a cheap zero-width window that only proves
//     "not better than what we have" - a full re-search only happens on the
//     rare move that actually beats it. Provably returns the same score as
//     plain alpha-beta, just visits fewer nodes when ordering is good.
// With alpha-beta off, none of this applies - that path stays a clean,
// unembellished full minimax so the pruning toggle has a pure baseline to
// contrast against.
import { getLegalMoves, applyMove, checkWin, opponent } from './engine.js';
import { evaluate } from './heuristics.js';
import { createTranspositionTable, boardKey } from './transposition.js';
import { isBookPly, bookMove } from './openingBook.js';

export const MAX_LOOKAHEAD_WITH_PRUNING = 5;
export const MAX_LOOKAHEAD_WITHOUT_PRUNING = 2;
const WIN_SCORE = 1_000_000;

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

// Value-based move equality: TT entries and killer moves are captured from
// other move-generation calls (even other board instances, via transposition),
// so they're never the same object reference as moves freshly generated for
// the current node - comparing by shape is required, not ===.
function cellKey(c) {
  return c.q * 100 + c.r; // unique for the q,r in [-4,4] range this board uses
}
function sameMove(a, b) {
  if (!a || !b || a.type !== b.type || a.dir.name !== b.dir.name || a.from.length !== b.from.length) return false;
  const bSet = new Set(b.from.map(cellKey));
  return a.from.every((c) => bSet.has(cellKey(c)));
}
function findMoveIndex(moves, target) {
  if (!target) return -1;
  return moves.findIndex((m) => sameMove(m, target));
}

// aiConfig: { lookahead, alphaBeta, caching, openingBook, heuristics, plyIndex }
export function findBestMove(board, color, aiConfig, transpositionTable = null) {
  const startTime = now();
  const legalAtRoot = getLegalMoves(board, color);
  if (legalAtRoot.length === 0) {
    return { move: null, stats: emptyStats(now() - startTime) };
  }

  if (aiConfig.openingBook && isBookPly(aiConfig.plyIndex ?? 0)) {
    const move = bookMove(board, color);
    if (move) {
      return {
        move,
        stats: { ...emptyStats(now() - startTime), pv: [move], source: 'book' },
      };
    }
  }

  const maxDepth = aiConfig.alphaBeta
    ? Math.min(aiConfig.lookahead, MAX_LOOKAHEAD_WITH_PRUNING)
    : Math.min(aiConfig.lookahead, MAX_LOOKAHEAD_WITHOUT_PRUNING);

  const tt = aiConfig.caching ? transpositionTable || createTranspositionTable() : null;
  const useAdvancedSearch = !!(aiConfig.alphaBeta && tt);
  const killers = useAdvancedSearch ? Array.from({ length: maxDepth + 1 }, () => [null, null]) : null;

  let nodesSearched = 0;
  let cacheHits = 0;

  function recordKiller(depth, move) {
    if (move.captures.length > 0) return; // captures are already ordered first; killers are for quiet moves
    const slot = killers[depth];
    if (sameMove(slot[0], move)) return;
    slot[1] = slot[0];
    slot[0] = move;
  }

  function orderMoves(moves, ttEntry, depth) {
    let ttMove = null;
    if (ttEntry && ttEntry.bestMove) {
      const i = findMoveIndex(moves, ttEntry.bestMove);
      if (i !== -1) ttMove = moves[i];
    }
    if (!useAdvancedSearch) {
      const rest = ttMove ? moves.filter((m) => m !== ttMove) : moves.slice();
      rest.sort((a, b) => b.captures.length - a.captures.length);
      return ttMove ? [ttMove, ...rest] : rest;
    }

    const [k1, k2] = killers[depth];
    const killerA = k1 && findMoveIndex(moves, k1) !== -1 ? moves[findMoveIndex(moves, k1)] : null;
    const killerB = k2 && findMoveIndex(moves, k2) !== -1 ? moves[findMoveIndex(moves, k2)] : null;
    const front = [ttMove, killerA !== ttMove ? killerA : null, killerB !== ttMove && killerB !== killerA ? killerB : null].filter(
      Boolean
    );
    const frontSet = new Set(front);
    const rest = moves.filter((m) => !frontSet.has(m));
    rest.sort((a, b) => b.captures.length - a.captures.length);
    return [...front, ...rest];
  }

  function negamax(bd, depth, alpha, beta, turnColor, pvOut) {
    nodesSearched++;
    const winner = checkWin(bd);
    if (winner) {
      const depthFromRoot = maxDepth - depth;
      const score = WIN_SCORE - depthFromRoot; // prefer faster wins / slower losses
      return winner === turnColor ? score : -score;
    }
    if (depth === 0) return evaluate(bd, turnColor, aiConfig);

    let moves = getLegalMoves(bd, turnColor);
    if (moves.length === 0) return evaluate(bd, turnColor, aiConfig);

    let ttKey = null;
    let ttEntry = null;
    if (tt) {
      ttKey = boardKey(bd, turnColor);
      ttEntry = tt.get(ttKey);
      if (ttEntry && ttEntry.depth >= depth) {
        cacheHits++;
        if (ttEntry.flag === 'exact') {
          if (pvOut) pvOut.push(ttEntry.bestMove);
          return ttEntry.score;
        }
        if (ttEntry.flag === 'lower') alpha = Math.max(alpha, ttEntry.score);
        else if (ttEntry.flag === 'upper') beta = Math.min(beta, ttEntry.score);
        if (alpha >= beta) {
          if (pvOut) pvOut.push(ttEntry.bestMove);
          return ttEntry.score;
        }
      }
    }

    moves = orderMoves(moves, ttEntry, depth);

    let bestScore = -Infinity;
    let bestMove = moves[0];
    const origAlpha = alpha;
    let searchedFirst = false;
    for (const move of moves) {
      const child = applyMove(bd, move);
      const childPv = [];
      let score;
      if (useAdvancedSearch && searchedFirst) {
        // Zero-width probe: cheaply prove this move isn't better than alpha.
        score = -negamax(child, depth - 1, -alpha - 1, -alpha, opponent(turnColor), childPv);
        if (score > alpha && score < beta) {
          // It surprised us - re-search properly to get its real score.
          childPv.length = 0;
          score = -negamax(child, depth - 1, -beta, -alpha, opponent(turnColor), childPv);
        }
      } else {
        score = -negamax(child, depth - 1, -beta, -alpha, opponent(turnColor), childPv);
      }
      searchedFirst = true;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
        if (pvOut) {
          pvOut.length = 0;
          pvOut.push(move, ...childPv);
        }
      }
      if (aiConfig.alphaBeta) {
        alpha = Math.max(alpha, score);
        if (alpha >= beta) {
          if (useAdvancedSearch) recordKiller(depth, move);
          break;
        }
      }
    }

    if (tt) {
      let flag = 'exact';
      if (bestScore <= origAlpha) flag = 'upper';
      else if (bestScore >= beta) flag = 'lower';
      tt.set(ttKey, { depth, score: bestScore, flag, bestMove });
    }
    return bestScore;
  }

  let pv = [];
  let score;
  if (useAdvancedSearch) {
    for (let d = 1; d <= maxDepth; d++) {
      pv = [];
      score = negamax(board, d, -Infinity, Infinity, color, pv);
    }
  } else {
    score = negamax(board, maxDepth, -Infinity, Infinity, color, pv);
  }

  const move = pv[0] || legalAtRoot[0];

  return {
    move,
    stats: {
      elapsedMs: now() - startTime,
      nodesSearched,
      cacheHits,
      score,
      pv,
      depthReached: maxDepth,
      cacheSize: tt ? tt.size : 0,
      source: 'search',
    },
  };
}

function emptyStats(elapsedMs) {
  return { elapsedMs, nodesSearched: 0, cacheHits: 0, score: null, pv: [], depthReached: 0, cacheSize: 0, source: 'none' };
}
