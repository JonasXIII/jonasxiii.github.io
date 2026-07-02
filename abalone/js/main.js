// main.js - wires the UI controls to state, runs the game loop (autoplay and
// manual play), and talks to the search worker so the board never freezes.
import * as state from './modules/state.js';
import { renderBoard } from './modules/render.js';
import { getLegalMoves, getGroups, moveNotation, opponent } from './modules/engine.js';
import { HEURISTICS } from './modules/heuristics.js';
import { BOTS, getBot, getUnlockedLevel, recordWin, resetProgress } from './modules/bots.js';
import { key as cellKey } from './modules/coords.js';
import { MAX_LOOKAHEAD_WITH_PRUNING, MAX_LOOKAHEAD_WITHOUT_PRUNING } from './modules/ai.js';

const worker = new Worker(new URL('./modules/searchWorker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let reqCounter = 0;

worker.onmessage = (e) => {
  const { requestId, move, stats } = e.data;
  const resolve = pending.get(requestId);
  if (resolve) {
    pending.delete(requestId);
    resolve({ move, stats });
  }
};

function askWorker(msg) {
  return new Promise((resolve) => {
    const requestId = ++reqCounter;
    pending.set(requestId, resolve);
    worker.postMessage({ ...msg, requestId });
  });
}

// --- Formatting helpers ---
function formatMs(ms) {
  if (ms == null) return '-';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}
function formatScore(score) {
  if (score == null) return '-';
  if (score >= 500000) return 'winning line found';
  if (score <= -500000) return 'losing line found';
  return Math.round(score).toString();
}
function formatPv(pv) {
  if (!pv || pv.length === 0) return '-';
  return pv.slice(0, 5).map(moveNotation).join('  ·  ');
}
function colorName(color) {
  return color === 'b' ? 'Black' : 'White';
}
function describeAiConfig(aiConfig) {
  const parts = [
    `lookahead ${aiConfig.lookahead}`,
    `alpha-beta ${aiConfig.alphaBeta ? 'on' : 'off'}`,
    `caching ${aiConfig.caching ? 'on' : 'off'}`,
    `opening principles ${aiConfig.openingBook ? 'on' : 'off'}`,
  ];
  const activeHeuristics = Object.values(HEURISTICS)
    .filter((h) => aiConfig.heuristics[h.key]?.enabled)
    .map((h) => `${h.label} (${aiConfig.heuristics[h.key].weight})`);
  return `${parts.join(', ')}. Values: ${activeHeuristics.join(', ') || 'none'}.`;
}

// --- DOM refs (populated on DOMContentLoaded) ---
let dom = {};

function actorKind(color) {
  const mode = state.getMode();
  if (mode === 'watch') return color === state.getAiColor() ? 'user-ai' : 'bot';
  return color === state.getHumanColor() ? 'human' : 'bot';
}
function actorLabel(color) {
  const kind = actorKind(color);
  if (kind === 'human') return 'you';
  if (kind === 'user-ai') return 'your AI';
  return 'the opponent';
}

// --- Game loop ---
let thinkingTimer = null;

function stopThinkingTimer() {
  if (thinkingTimer) {
    clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
}

function startThinkingTimer() {
  stopThinkingTimer();
  const start = performance.now();
  thinkingTimer = setInterval(() => {
    dom.thinkingTime.textContent = formatMs(performance.now() - start);
  }, 100);
}

async function advanceGame() {
  if (state.getStatus() !== 'ready') return;
  const turn = state.getTurn();
  const kind = actorKind(turn);
  if (kind === 'human') {
    render();
    return;
  }

  state.setStatus('thinking');
  render();
  startThinkingTimer();

  let result;
  if (kind === 'user-ai') {
    result = await askWorker({
      type: 'find-move',
      board: state.getBoard(),
      color: turn,
      aiConfig: state.getAiConfig(),
      plyIndex: state.getPlyIndex(),
    });
  } else {
    result = await askWorker({
      type: 'bot-move',
      board: state.getBoard(),
      color: turn,
      level: state.getBotLevel(),
      plyIndex: state.getPlyIndex(),
    });
  }
  stopThinkingTimer();

  if (!result.move) {
    // No legal moves for the side to move (shouldn't happen under normal Abalone
    // rules, but guard against a stalled game rather than throwing).
    state.setStatus('gameover');
    render();
    return;
  }

  state.applyMoveToState(result.move, result.stats);
}

function handleGameOver() {
  const winner = state.getWinner();
  const mode = state.getMode();
  const relevantColor = mode === 'watch' ? state.getAiColor() : state.getHumanColor();
  if (winner === relevantColor) {
    recordWin(state.getBotLevel());
  }
  renderBotPicker();
}

// --- Manual play: selection + click handling ---
function handleCellClick(cell) {
  const board = state.getBoard();
  const humanColor = state.getHumanColor();
  const clickedKey = cellKey(cell.q, cell.r);

  const { movesByDestKey } = computeLegalTargets();
  const targetMove = movesByDestKey.get(clickedKey);
  if (targetMove) {
    state.setSelection([]);
    state.applyMoveToState(targetMove, { source: 'human' });
    return;
  }

  // Otherwise this must be a click on one of the human's own marbles.
  const groups = getGroups(board, humanColor);
  const current = state.getSelection();
  const currentKeys = new Set(current.map((c) => cellKey(c.q, c.r)));

  if (currentKeys.has(clickedKey) && current.length === 1) {
    state.setSelection([]);
    return;
  }

  const candidateCells = currentKeys.has(clickedKey)
    ? current.filter((c) => cellKey(c.q, c.r) !== clickedKey)
    : [...current, cell];
  const candidateKeySet = new Set(candidateCells.map((c) => cellKey(c.q, c.r)));
  const matchingGroup = groups.find(
    (g) => g.cells.length === candidateKeySet.size && g.cells.every((c) => candidateKeySet.has(cellKey(c.q, c.r)))
  );
  state.setSelection(matchingGroup ? matchingGroup.cells : [cell]);
  render();
}

function computeLegalTargets() {
  const board = state.getBoard();
  const humanColor = state.getHumanColor();
  const selection = state.getSelection();
  const movesByDestKey = new Map();
  if (selection.length === 0) return { movesByDestKey };
  const selKeySet = new Set(selection.map((c) => cellKey(c.q, c.r)));
  const allMoves = getLegalMoves(board, humanColor);
  for (const m of allMoves) {
    if (m.from.length !== selKeySet.size) continue;
    if (!m.from.every((c) => selKeySet.has(cellKey(c.q, c.r)))) continue;
    for (const c of m.to) movesByDestKey.set(cellKey(c.q, c.r), m);
  }
  return { movesByDestKey };
}

// --- Rendering ---
function render() {
  renderStatus();
  renderBoardSvg();
  renderCaptured();
  renderThinking();
  renderHistory();
  renderBotPicker();
  renderReveal();
}

function renderStatus() {
  const status = state.getStatus();
  const el = dom.gameStatus;
  el.className = status === 'gameover' ? 'status-gameover' : 'status-normal';
  if (status === 'idle') {
    el.textContent = 'Set up a game and press New Game.';
  } else if (status === 'thinking') {
    el.textContent = `${colorName(state.getTurn())} (${actorLabel(state.getTurn())}) is thinking...`;
  } else if (status === 'gameover') {
    const winner = state.getWinner();
    el.textContent = `${colorName(winner)} (${actorLabel(winner)}) wins!`;
  } else {
    el.textContent = `${colorName(state.getTurn())}'s turn (${actorLabel(state.getTurn())})`;
  }
}

function renderBoardSvg() {
  const board = state.getBoard();
  const status = state.getStatus();
  const mode = state.getMode();
  const humanColor = state.getHumanColor();
  const turn = state.getTurn();

  const selected = new Set(state.getSelection().map((c) => cellKey(c.q, c.r)));
  const lastMove = new Set();
  const lastMoveObj = state.getLastMove();
  if (lastMoveObj) {
    for (const c of [...lastMoveObj.from, ...lastMoveObj.to, ...lastMoveObj.pushedFrom, ...lastMoveObj.pushedTo]) {
      lastMove.add(cellKey(c.q, c.r));
    }
  }

  const clickable = new Set();
  const interactive = mode === 'play' && status === 'ready' && turn === humanColor;
  if (interactive) {
    // Own marbles that appear in ANY legal move stay clickable regardless of
    // the current selection, so the user can click a different/adjacent
    // marble to extend or restart their selection rather than getting stuck
    // once one marble is picked. Legal destination cells are clickable too.
    const { movesByDestKey } = computeLegalTargets();
    for (const k of movesByDestKey.keys()) clickable.add(k);
    for (const m of getLegalMoves(board, humanColor)) {
      for (const c of m.from) clickable.add(cellKey(c.q, c.r));
    }
  }

  const legalTargets = interactive ? new Set(computeLegalTargets().movesByDestKey.keys()) : new Set();

  renderBoard(dom.svg, board, {
    selected,
    legalTargets,
    lastMove,
    clickable,
    onCellClick: interactive ? handleCellClick : null,
  });
}

function renderCaptured() {
  const bLost = state.getMarblesLost('b');
  const wLost = state.getMarblesLost('w');
  dom.capturedBlack.textContent = bLost > 0 ? '●'.repeat(bLost) : '';
  dom.capturedBlack.title = `Black has lost ${bLost} of 6`;
  dom.capturedWhite.textContent = wLost > 0 ? '○'.repeat(wLost) : '';
  dom.capturedWhite.title = `White has lost ${wLost} of 6`;
}

function renderThinking() {
  const status = state.getStatus();
  const stats = state.getLastStats();
  dom.thinkingTurn.textContent = `${colorName(state.getTurn())} (${actorLabel(state.getTurn())})`;
  if (status === 'thinking') {
    dom.thinkingNodes.textContent = '...';
    dom.thinkingCache.textContent = '...';
    dom.thinkingCacheSize.textContent = '...';
    dom.thinkingScore.textContent = '...';
    dom.thinkingDepth.textContent = '...';
    dom.thinkingSource.textContent = '...';
    dom.thinkingPv.textContent = '...';
    return;
  }
  if (!stats || stats.source === 'human') {
    dom.thinkingTime.textContent = '-';
    dom.thinkingNodes.textContent = '-';
    dom.thinkingCache.textContent = '-';
    dom.thinkingCacheSize.textContent = '-';
    dom.thinkingScore.textContent = '-';
    dom.thinkingDepth.textContent = '-';
    dom.thinkingSource.textContent = stats?.source === 'human' ? 'you moved it yourself' : '-';
    dom.thinkingPv.textContent = '-';
    return;
  }
  dom.thinkingTime.textContent = formatMs(stats.elapsedMs);
  dom.thinkingNodes.textContent = stats.nodesSearched.toLocaleString();
  dom.thinkingCache.textContent = stats.cacheHits.toLocaleString();
  dom.thinkingCacheSize.textContent = stats.cacheSize.toLocaleString();
  dom.thinkingScore.textContent = formatScore(stats.score);
  dom.thinkingDepth.textContent = stats.depthReached;
  dom.thinkingSource.textContent =
    stats.source === 'book' ? 'opening principles' : stats.source === 'random' ? 'random (low-level bot)' : 'search';
  dom.thinkingPv.textContent = formatPv(stats.pv);
}

function renderHistory() {
  const history = state.getMoveHistory();
  if (history.length === 0) {
    dom.moveHistory.innerHTML = '<div class="history-empty">No moves yet</div>';
    return;
  }
  dom.moveHistory.innerHTML = history
    .map((h, i) => {
      const icon = h.color === 'b' ? '⚫' : '⚪';
      return `<div class="move-pair"><span class="move-number">${i + 1}.</span><span class="move-notation">${icon} ${h.notation}</span></div>`;
    })
    .join('');
  dom.moveHistory.scrollTop = dom.moveHistory.scrollHeight;
}

function renderBotPicker() {
  const unlocked = getUnlockedLevel();
  const selected = state.getBotLevel();
  dom.botPicker.innerHTML = '';
  for (const bot of BOTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'difficulty-btn bot-level-btn';
    if (bot.level > unlocked) btn.classList.add('locked');
    if (bot.level === selected) btn.classList.add('active');
    btn.textContent = bot.level > unlocked ? `🔒 Level ${bot.level}` : `${bot.level}. ${bot.name}`;
    btn.disabled = bot.level > unlocked;
    btn.addEventListener('click', () => {
      state.setBotLevel(bot.level);
      render();
    });
    dom.botPicker.appendChild(btn);
  }
}

function renderReveal() {
  if (state.getStatus() !== 'gameover') {
    dom.revealSection.hidden = true;
    return;
  }
  dom.revealSection.hidden = false;
  const bot = getBot(state.getBotLevel());
  dom.revealPanel.innerHTML = `
    <p><strong>${bot.name}</strong> (level ${bot.level}) was your opponent.</p>
    <p>${describeAiConfig(bot.aiConfig)}</p>
    <p>Random-move chance: ${Math.round(bot.noise * 100)}%.</p>
  `;
}

// --- Setup: heuristics controls ---
function buildHeuristicsControls() {
  dom.heuristicsControls.innerHTML = '';
  for (const h of Object.values(HEURISTICS)) {
    const row = document.createElement('div');
    row.className = 'heuristic-row';
    row.innerHTML = `
      <label class="heuristic-head">
        <input type="checkbox" id="h-${h.key}-enabled">
        ${h.label}
      </label>
      <p class="heuristic-desc">${h.description}</p>
      <input type="range" id="h-${h.key}-weight" min="0" max="150" step="1">
    `;
    dom.heuristicsControls.appendChild(row);

    const checkbox = row.querySelector(`#h-${h.key}-enabled`);
    const slider = row.querySelector(`#h-${h.key}-weight`);
    checkbox.addEventListener('change', () => {
      state.setHeuristicConfig(h.key, { enabled: checkbox.checked });
    });
    slider.addEventListener('input', () => {
      state.setHeuristicConfig(h.key, { weight: Number(slider.value) });
    });
  }
}

function syncAiControlsFromState() {
  const cfg = state.getAiConfig();
  dom.alphaBetaToggle.checked = cfg.alphaBeta;
  dom.cachingToggle.checked = cfg.caching;
  dom.openingBookToggle.checked = cfg.openingBook;

  const maxDepth = cfg.alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
  dom.lookaheadSlider.max = String(maxDepth);
  dom.lookaheadSlider.value = String(Math.min(cfg.lookahead, maxDepth));
  dom.lookaheadValue.textContent = dom.lookaheadSlider.value;
  dom.lookaheadNote.textContent = cfg.alphaBeta
    ? ''
    : `Without alpha-beta pruning, full minimax must explore every branch, so lookahead is capped at ${MAX_LOOKAHEAD_WITHOUT_PRUNING} to stay responsive.`;

  for (const h of Object.values(HEURISTICS)) {
    const checkbox = document.getElementById(`h-${h.key}-enabled`);
    const slider = document.getElementById(`h-${h.key}-weight`);
    const hcfg = cfg.heuristics[h.key];
    checkbox.checked = hcfg.enabled;
    slider.value = String(hcfg.weight);
  }
}

// --- Wire up static controls ---
function wireControls() {
  dom.modeControls.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.setMode(radio.value);
        render();
      }
    });
  });

  dom.lookaheadSlider.addEventListener('input', () => {
    dom.lookaheadValue.textContent = dom.lookaheadSlider.value;
    state.setAiConfig({ lookahead: Number(dom.lookaheadSlider.value) });
  });

  dom.alphaBetaToggle.addEventListener('change', () => {
    const alphaBeta = dom.alphaBetaToggle.checked;
    const maxDepth = alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
    state.setAiConfig({ alphaBeta, lookahead: Math.min(state.getAiConfig().lookahead, maxDepth) });
  });
  dom.cachingToggle.addEventListener('change', () => {
    state.setAiConfig({ caching: dom.cachingToggle.checked });
  });
  dom.openingBookToggle.addEventListener('change', () => {
    state.setAiConfig({ openingBook: dom.openingBookToggle.checked });
  });

  dom.resetAiBtn.addEventListener('click', () => state.resetAiConfig());
  dom.resetProgressBtn.addEventListener('click', () => {
    resetProgress();
    renderBotPicker();
  });

  dom.newGameBtn.addEventListener('click', () => {
    const mode = state.getMode();
    worker.postMessage({ type: 'reset' });
    state.newGame({ mode, botLevel: state.getBotLevel(), humanColor: 'b', aiColor: 'b' });
    render();
    advanceGame();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  dom = {
    modeControls: document.querySelectorAll('#mode-controls input[name="mode"]'),
    botPicker: document.getElementById('bot-level-picker'),
    lookaheadSlider: document.getElementById('lookahead-slider'),
    lookaheadValue: document.getElementById('lookahead-value'),
    lookaheadNote: document.getElementById('lookahead-note'),
    alphaBetaToggle: document.getElementById('alpha-beta-toggle'),
    cachingToggle: document.getElementById('caching-toggle'),
    openingBookToggle: document.getElementById('opening-book-toggle'),
    heuristicsControls: document.getElementById('heuristics-controls'),
    resetAiBtn: document.getElementById('reset-ai-btn'),
    resetProgressBtn: document.getElementById('reset-progress-btn'),
    newGameBtn: document.getElementById('new-game-btn'),
    gameStatus: document.getElementById('game-status'),
    svg: document.getElementById('board'),
    capturedBlack: document.getElementById('captured-black'),
    capturedWhite: document.getElementById('captured-white'),
    thinkingTurn: document.getElementById('thinking-turn'),
    thinkingTime: document.getElementById('thinking-time'),
    thinkingNodes: document.getElementById('thinking-nodes'),
    thinkingCache: document.getElementById('thinking-cache'),
    thinkingCacheSize: document.getElementById('thinking-cache-size'),
    thinkingScore: document.getElementById('thinking-score'),
    thinkingDepth: document.getElementById('thinking-depth'),
    thinkingSource: document.getElementById('thinking-source'),
    thinkingPv: document.getElementById('thinking-pv'),
    revealSection: document.getElementById('reveal-section'),
    revealPanel: document.getElementById('reveal-panel'),
    moveHistory: document.getElementById('move-history'),
  };

  buildHeuristicsControls();
  state.setBotLevel(getUnlockedLevel());
  syncAiControlsFromState();
  wireControls();

  state.subscribe((eventType) => {
    if (eventType === 'ai-config-changed') syncAiControlsFromState();
    if (eventType === 'move-applied') {
      render();
      if (state.getStatus() === 'gameover') {
        handleGameOver();
        render();
      } else {
        setTimeout(advanceGame, 350);
      }
    }
    if (eventType === 'selection-changed') render();
    if (eventType === 'new-game' || eventType === 'mode-changed' || eventType === 'bot-level-changed') render();
  });

  state.newGame({ mode: 'watch', botLevel: getUnlockedLevel(), humanColor: 'b', aiColor: 'b' });
  render();
});
