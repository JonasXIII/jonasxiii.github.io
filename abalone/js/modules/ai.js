// ai.js - negamax search with a toggleable alpha-beta prune, depth-limited by the
// user's "lookahead" setting, with optional transposition-table caching and an
// optional opening-book shortcut for the first few plies.
import { getLegalMoves, applyMove, checkWin, opponent } from './engine.js';
import { evaluate } from './heuristics.js';
import { createTranspositionTable, boardKey } from './transposition.js';
import { isBookPly, bookMove } from './openingBook.js';

export const MAX_LOOKAHEAD_WITH_PRUNING = 4;
export const MAX_LOOKAHEAD_WITHOUT_PRUNING = 2;
const WIN_SCORE = 1_000_000;

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
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
  let nodesSearched = 0;
  let cacheHits = 0;

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

    if (ttEntry && ttEntry.bestMove) {
      const idx = moves.indexOf(ttEntry.bestMove);
      if (idx > 0) {
        moves = [ttEntry.bestMove, ...moves.slice(0, idx), ...moves.slice(idx + 1)];
      }
    } else {
      moves = [...moves].sort((a, b) => b.captures.length - a.captures.length);
    }

    let bestScore = -Infinity;
    let bestMove = moves[0];
    const origAlpha = alpha;
    for (const move of moves) {
      const child = applyMove(bd, move);
      const childPv = [];
      const score = -negamax(child, depth - 1, -beta, -alpha, opponent(turnColor), childPv);
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
        if (alpha >= beta) break;
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

  const pv = [];
  const score = negamax(board, maxDepth, -Infinity, Infinity, color, pv);
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
