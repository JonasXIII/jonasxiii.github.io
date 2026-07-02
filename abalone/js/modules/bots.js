// bots.js - 5 hidden difficulty presets and the localStorage-backed unlock ladder.
// Bot internals are deliberately not exposed while playing; results.js/main.js
// reveals a level's actual settings only after a match against it ends.
import { getLegalMoves } from './engine.js';
import { defaultHeuristicConfig } from './heuristics.js';
import { findBestMove } from './ai.js';

function heuristicSubset(enabledKeys) {
  const cfg = defaultHeuristicConfig();
  for (const key of Object.keys(cfg)) cfg[key].enabled = enabledKeys.includes(key);
  return cfg;
}

export const BOTS = [
  {
    level: 1,
    name: 'Novice',
    noise: 0.4,
    aiConfig: {
      lookahead: 1,
      alphaBeta: true,
      caching: false,
      openingBook: false,
      heuristics: heuristicSubset(['marbleDiff']),
    },
  },
  {
    level: 2,
    name: 'Apprentice',
    noise: 0.2,
    aiConfig: {
      lookahead: 2,
      alphaBeta: true,
      caching: false,
      openingBook: false,
      heuristics: heuristicSubset(['marbleDiff', 'centerControl', 'edgeExposure']),
    },
  },
  {
    level: 3,
    name: 'Adept',
    noise: 0.08,
    aiConfig: {
      lookahead: 3,
      alphaBeta: true,
      caching: true,
      openingBook: false,
      heuristics: heuristicSubset(['marbleDiff', 'centerControl', 'edgeExposure', 'cohesion', 'tripleFormation']),
    },
  },
  {
    level: 4,
    name: 'Expert',
    noise: 0,
    aiConfig: {
      lookahead: 3,
      alphaBeta: true,
      caching: true,
      openingBook: true,
      heuristics: heuristicSubset(['marbleDiff', 'centerControl', 'edgeExposure', 'cohesion', 'tripleFormation']),
    },
  },
  {
    level: 5,
    name: 'Master',
    noise: 0,
    aiConfig: {
      // Deliberately skips the (very expensive) mobility heuristic - at this
      // depth it would push move times well past what's playable. Depth is
      // Master's edge over Expert instead.
      lookahead: 4,
      alphaBeta: true,
      caching: true,
      openingBook: true,
      heuristics: heuristicSubset(['marbleDiff', 'centerControl', 'edgeExposure', 'cohesion', 'tripleFormation']),
    },
  },
];

export function getBot(level) {
  return BOTS.find((b) => b.level === level) || BOTS[0];
}

// A bot's move: run the real search (so stats are honest for the reveal panel),
// then - for lower levels - sometimes discard it in favor of a random legal
// move so the bot is beatable and feels less robotic.
export function getBotMove(board, color, level, plyIndex, transpositionTable = null) {
  const bot = getBot(level);
  const result = findBestMove(board, color, { ...bot.aiConfig, plyIndex }, transpositionTable);
  if (bot.noise > 0 && Math.random() < bot.noise) {
    const legal = getLegalMoves(board, color);
    if (legal.length > 0) {
      const randomMove = legal[Math.floor(Math.random() * legal.length)];
      // The pv/score belonged to the search's actual best move, not this
      // random one - clear them so the thinking panel doesn't show a line
      // that wasn't the move played.
      return {
        move: randomMove,
        stats: { ...result.stats, source: 'random', pv: [randomMove], score: null },
      };
    }
  }
  return result;
}

const STORAGE_KEY = 'abalone-unlocked-level-v1';

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

export function getUnlockedLevel() {
  if (!hasStorage()) return 1;
  try {
    const raw = parseInt(localStorage.getItem(STORAGE_KEY) || '1', 10);
    return Math.min(5, Math.max(1, Number.isNaN(raw) ? 1 : raw));
  } catch {
    return 1;
  }
}

export function recordWin(levelBeaten) {
  if (!hasStorage()) return;
  const current = getUnlockedLevel();
  if (levelBeaten >= current && current < 5) {
    try {
      localStorage.setItem(STORAGE_KEY, String(current + 1));
    } catch {
      // ignore (private browsing, storage disabled, etc.)
    }
  }
}

export function resetProgress() {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
