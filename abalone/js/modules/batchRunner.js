// batchRunner.js - plays N full games with no board animation, for the
// "Batch Run" teaching mode: configure how two AIs think, then see the
// aggregate result instead of watching one game at a time.
import { createInitialBoard, applyMove, checkWin, opponent } from './engine.js';
import { askWorker } from './workerClient.js';

const MAX_PLIES = 400; // safety net: two weak/noisy bots could otherwise shuffle forever

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function playOneGame({ mode, botLevel, aiConfigA, aiConfigB, colorOfA, plyOffsetForBook }) {
  let board = createInitialBoard();
  let turn = 'b';
  let plyIndex = 0;
  const colorOfB = opponent(colorOfA);
  const timeA = [];
  const timeB = [];
  let nodesA = 0;
  let nodesB = 0;

  while (plyIndex < MAX_PLIES) {
    const winner = checkWin(board);
    if (winner) break;

    const mover = turn;
    const isA = mover === colorOfA;
    let result;
    if (mode === 'bot' && !isA) {
      result = await askWorker({ type: 'bot-move', board, color: mover, level: botLevel, plyIndex });
    } else {
      const aiConfig = isA ? aiConfigA : aiConfigB;
      result = await askWorker({ type: 'find-move', board, color: mover, aiConfig, plyIndex });
    }
    if (!result.move) break; // no legal moves - treat as a stalled game

    board = applyMove(board, result.move);
    if (isA) {
      timeA.push(result.stats.elapsedMs);
      nodesA += result.stats.nodesSearched || 0;
    } else {
      timeB.push(result.stats.elapsedMs);
      nodesB += result.stats.nodesSearched || 0;
    }
    plyIndex += 1;
    turn = opponent(mover);
  }

  const winner = checkWin(board);
  const winnerSide = winner ? (winner === colorOfA ? 'A' : 'B') : 'timeout';

  return {
    winnerSide,
    plies: plyIndex,
    avgTimeA: avg(timeA),
    avgTimeB: avg(timeB),
    totalNodesA: nodesA,
    totalNodesB: nodesB,
  };
}

// mode: 'bot' (A = aiConfigA, B = the given bot level) or 'custom' (A vs B, both configs)
export async function runBatch({ mode, botLevel, aiConfigA, aiConfigB, numGames, onProgress, isCancelled }) {
  const perGame = [];
  let winsA = 0;
  let winsB = 0;
  let timeouts = 0;

  for (let i = 0; i < numGames; i++) {
    if (isCancelled && isCancelled()) break;

    // Alternate who plays black (first-move seat) so it cancels out across the batch.
    const colorOfA = i % 2 === 0 ? 'b' : 'w';
    const game = await playOneGame({ mode, botLevel, aiConfigA, aiConfigB, colorOfA });
    perGame.push(game);
    if (game.winnerSide === 'A') winsA += 1;
    else if (game.winnerSide === 'B') winsB += 1;
    else timeouts += 1;

    if (onProgress) onProgress(i + 1, numGames, game);
  }

  const completed = perGame.length;
  return {
    mode,
    botLevel,
    numGamesRequested: numGames,
    numGamesCompleted: completed,
    winsA,
    winsB,
    timeouts,
    avgPlies: avg(perGame.map((g) => g.plies)),
    avgTimeA: avg(perGame.map((g) => g.avgTimeA)),
    avgTimeB: avg(perGame.map((g) => g.avgTimeB)),
    avgNodesA: avg(perGame.map((g) => g.totalNodesA)),
    avgNodesB: avg(perGame.map((g) => g.totalNodesB)),
    perGame,
  };
}
