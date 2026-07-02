// state.js - central mutable state + observer pattern, mirroring the
// subscribe/notify convention used in mtg/js/modules/state.js.
import { createInitialBoard, applyMove, checkWin, countColor, opponent, moveNotation } from './engine.js';
import { defaultHeuristicConfig } from './heuristics.js';
import { key as cellKey } from './coords.js';

let _board = createInitialBoard();
let _turn = 'b';
let _mode = 'watch'; // 'watch' (user AI vs bot) | 'play' (human vs bot)
let _humanColor = 'b';
let _aiColor = 'b'; // which color the user-configured AI plays, in 'watch' mode
let _botLevel = 1;
let _aiConfig = {
  lookahead: 3,
  alphaBeta: true,
  caching: true,
  openingBook: true,
  heuristics: defaultHeuristicConfig(),
};
let _plyIndex = 0;
let _moveHistory = [];
let _status = 'idle'; // idle | thinking | ready | gameover
let _winner = null;
let _lastMove = null;
let _lastStats = null;
let _selection = [];
let _listeners = [];

export function subscribe(listener) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

function notify(eventType, data) {
  for (const listener of _listeners) {
    try {
      listener(eventType, data);
    } catch (e) {
      console.error('State listener error:', e);
    }
  }
}

// --- Getters ---
export function getBoard() { return _board; }
export function getTurn() { return _turn; }
export function getMode() { return _mode; }
export function getHumanColor() { return _humanColor; }
export function getAiColor() { return _aiColor; }
export function getBotColor() { return opponent(_aiColor); }
export function getBotLevel() { return _botLevel; }
export function getAiConfig() { return _aiConfig; }
export function getPlyIndex() { return _plyIndex; }
export function getMoveHistory() { return _moveHistory; }
export function getStatus() { return _status; }
export function getWinner() { return _winner; }
export function getLastMove() { return _lastMove; }
export function getLastStats() { return _lastStats; }
export function getSelection() { return _selection; }
export function getMarblesLost(color) { return 14 - countColor(_board, color); }

// --- Mutations ---
export function setMode(mode) {
  _mode = mode;
  notify('mode-changed', { mode });
}

export function setBotLevel(level) {
  _botLevel = level;
  notify('bot-level-changed', { level });
}

export function setAiConfig(partial) {
  _aiConfig = { ..._aiConfig, ...partial };
  notify('ai-config-changed', { aiConfig: _aiConfig });
}

export function setHeuristicConfig(heuristicKey, partial) {
  _aiConfig = {
    ..._aiConfig,
    heuristics: {
      ..._aiConfig.heuristics,
      [heuristicKey]: { ..._aiConfig.heuristics[heuristicKey], ...partial },
    },
  };
  notify('ai-config-changed', { aiConfig: _aiConfig });
}

export function resetAiConfig() {
  _aiConfig = {
    lookahead: 3,
    alphaBeta: true,
    caching: true,
    openingBook: true,
    heuristics: defaultHeuristicConfig(),
  };
  notify('ai-config-changed', { aiConfig: _aiConfig });
}

export function setSelection(cells) {
  _selection = cells;
  notify('selection-changed', { selection: _selection });
}

export function setStatus(status) {
  _status = status;
  notify('status-changed', { status });
}

export function newGame({ mode, botLevel, humanColor = 'b', aiColor = 'b' } = {}) {
  _board = createInitialBoard();
  _turn = 'b';
  _mode = mode ?? _mode;
  _botLevel = botLevel ?? _botLevel;
  _humanColor = humanColor;
  _aiColor = aiColor;
  _plyIndex = 0;
  _moveHistory = [];
  _winner = null;
  _lastMove = null;
  _lastStats = null;
  _selection = [];
  _status = 'ready';
  notify('new-game', {});
}

export function applyMoveToState(move, stats) {
  const mover = _turn;
  _board = applyMove(_board, move);
  _lastMove = move;
  _lastStats = stats;
  const touched = new Set();
  for (const c of [...move.from, ...move.to, ...move.pushedFrom, ...move.pushedTo, ...move.captures]) {
    touched.add(cellKey(c.q, c.r));
  }
  _moveHistory = [..._moveHistory, { color: mover, notation: moveNotation(move), stats }];
  _plyIndex += 1;
  _turn = opponent(mover);
  _selection = [];

  const winner = checkWin(_board);
  if (winner) {
    _winner = winner;
    _status = 'gameover';
  } else {
    _status = 'ready';
  }

  notify('move-applied', { move, stats, touched, winner: _winner });
}
