// optimizer.js - "Find the best AI": a small hill-climbing search over AI
// settings. Not exhaustive (the space is too large - 4 depths x 2 alpha-beta
// x 2 caching x 2 opening-book x 2^6 heuristic on/off x continuous weights),
// so instead of a grid this mutates the *current best* config each round and
// keeps whatever wins the most - later rounds are biased toward whatever
// already worked, which is what "learn as it goes" means here.
import { MAX_LOOKAHEAD_WITH_PRUNING, MAX_LOOKAHEAD_WITHOUT_PRUNING } from './ai.js';
import { runBatch } from './batchRunner.js';

function deepCopyConfig(config) {
  return {
    ...config,
    heuristics: Object.fromEntries(Object.entries(config.heuristics).map(([k, v]) => [k, { ...v }])),
  };
}

const MUTATION_KINDS = ['lookahead', 'alphaBeta', 'caching', 'openingBook', 'heuristicToggle', 'heuristicWeight'];

function applyMutation(config, kind) {
  switch (kind) {
    case 'lookahead': {
      const maxDepth = config.alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
      const delta = Math.random() < 0.5 ? -1 : 1;
      config.lookahead = Math.max(1, Math.min(maxDepth, config.lookahead + delta));
      break;
    }
    case 'alphaBeta': {
      config.alphaBeta = !config.alphaBeta;
      const maxDepth = config.alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
      config.lookahead = Math.min(config.lookahead, maxDepth);
      break;
    }
    case 'caching':
      config.caching = !config.caching;
      break;
    case 'openingBook':
      config.openingBook = !config.openingBook;
      break;
    case 'heuristicToggle': {
      const keys = Object.keys(config.heuristics);
      const key = keys[Math.floor(Math.random() * keys.length)];
      config.heuristics[key].enabled = !config.heuristics[key].enabled;
      break;
    }
    case 'heuristicWeight': {
      const enabledKeys = Object.keys(config.heuristics).filter((k) => config.heuristics[k].enabled);
      const keys = enabledKeys.length > 0 ? enabledKeys : Object.keys(config.heuristics);
      const key = keys[Math.floor(Math.random() * keys.length)];
      const factor = 0.5 + Math.random(); // 0.5x - 1.5x
      config.heuristics[key].weight = Math.max(0, Math.min(150, Math.round(config.heuristics[key].weight * factor)));
      break;
    }
  }
}

export function mutateConfig(config) {
  const next = deepCopyConfig(config);
  const numMutations = Math.random() < 0.4 ? 2 : 1;
  for (let i = 0; i < numMutations; i++) {
    applyMutation(next, MUTATION_KINDS[Math.floor(Math.random() * MUTATION_KINDS.length)]);
  }
  return next;
}

function avg(arr) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function winRateOf(batchResult) {
  const total = batchResult.numGamesCompleted || 1;
  return batchResult.winsA / total;
}

// Cheap group-by-average over the tested history: does having X on vs off
// correlate with a higher win rate, across every config actually tried?
function computeInsights(history) {
  function split(predicate) {
    const on = history.filter((h) => predicate(h.config)).map((h) => h.winRate);
    const off = history.filter((h) => !predicate(h.config)).map((h) => h.winRate);
    return { onAvg: avg(on), onCount: on.length, offAvg: avg(off), offCount: off.length };
  }

  const insights = {
    alphaBeta: split((c) => c.alphaBeta),
    caching: split((c) => c.caching),
    openingBook: split((c) => c.openingBook),
    heuristics: {},
    lookahead: {},
  };

  const heuristicKeys = Object.keys(history[0]?.config.heuristics || {});
  for (const key of heuristicKeys) {
    insights.heuristics[key] = split((c) => c.heuristics[key].enabled);
  }

  const depths = [...new Set(history.map((h) => h.config.lookahead))].sort((a, b) => a - b);
  for (const d of depths) {
    insights.lookahead[d] = avg(history.filter((h) => h.config.lookahead === d).map((h) => h.winRate));
  }

  return insights;
}

// baselineConfig: the starting point. botLevel: the fixed opponent. rounds x
// candidatesPerRound x gamesPerCandidate controls total games played.
export async function runOptimizer({ baselineConfig, botLevel, rounds, candidatesPerRound, gamesPerCandidate, onProgress, isCancelled }) {
  const history = [];

  async function evaluateConfig(config, round, label) {
    const result = await runBatch({
      mode: 'bot',
      botLevel,
      aiConfigA: config,
      aiConfigB: config,
      numGames: gamesPerCandidate,
      isCancelled,
    });
    const entry = {
      config,
      winRate: winRateOf(result),
      gamesPlayed: result.numGamesCompleted,
      avgPlies: result.avgPlies,
      avgTimeA: result.avgTimeA,
      round,
      label,
    };
    history.push(entry);
    return entry;
  }

  let current = await evaluateConfig(baselineConfig, 0, 'baseline');
  if (onProgress) onProgress({ round: 0, rounds, candidateIndex: 0, candidatesPerRound, current: history[0] });

  for (let round = 1; round <= rounds; round++) {
    if (isCancelled && isCancelled()) break;
    let roundBest = current;
    for (let c = 0; c < candidatesPerRound; c++) {
      if (isCancelled && isCancelled()) break;
      const candidateConfig = mutateConfig(current.config);
      const entry = await evaluateConfig(candidateConfig, round, `Round ${round}, candidate ${c + 1}`);
      if (entry.winRate > roundBest.winRate) roundBest = entry;
      if (onProgress) onProgress({ round, rounds, candidateIndex: c + 1, candidatesPerRound, current: entry });
    }
    current = roundBest; // elitism: only move on if something beat the reigning champion
  }

  return {
    bestConfig: current.config,
    bestWinRate: current.winRate,
    bestLabel: current.label,
    history,
    insights: computeInsights(history),
  };
}
