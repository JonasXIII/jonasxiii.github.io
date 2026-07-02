// searchWorker.js - runs AI search off the main thread so a deep or unpruned
// search never freezes the board/UI. Loaded as a module worker (`new Worker(url,
// { type: 'module' })`), so plain ES imports work with no bundler.
import { findBestMove } from './ai.js';
import { getBotMove } from './bots.js';
import { createTranspositionTable } from './transposition.js';

// One transposition table per distinct heuristic configuration - cached scores
// are only meaningful for the weights/heuristics that produced them, so a user
// AI's table and each bot level's table must never be shared or mixed.
let ttStore = new Map();

function heuristicSignature(heuristics) {
  return Object.keys(heuristics)
    .sort()
    .map((k) => `${k}:${heuristics[k].enabled ? 1 : 0}:${heuristics[k].weight}`)
    .join(',');
}

function ttFor(signature) {
  if (!ttStore.has(signature)) ttStore.set(signature, createTranspositionTable());
  return ttStore.get(signature);
}

self.onmessage = (e) => {
  const msg = e.data;

  if (msg.type === 'reset') {
    ttStore = new Map();
    return;
  }

  if (msg.type === 'find-move') {
    const tt = ttFor(`user:${heuristicSignature(msg.aiConfig.heuristics)}`);
    const result = findBestMove(msg.board, msg.color, { ...msg.aiConfig, plyIndex: msg.plyIndex }, tt);
    self.postMessage({ type: 'result', requestId: msg.requestId, move: result.move, stats: result.stats });
    return;
  }

  if (msg.type === 'bot-move') {
    const tt = ttFor(`bot:${msg.level}`);
    const result = getBotMove(msg.board, msg.color, msg.level, msg.plyIndex, tt);
    self.postMessage({ type: 'result', requestId: msg.requestId, move: result.move, stats: result.stats });
    return;
  }
};
