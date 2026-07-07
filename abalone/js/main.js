// main.js - wires the UI to state, runs the watch/play game loop, and drives
// batch simulations. Config lives behind two reusable <dialog> modals so the
// main view stays uncluttered.
import * as state from './modules/state.js';
import { renderBoard } from './modules/render.js';
import { getLegalMoves, getGroups, moveNotation } from './modules/engine.js';
import { HEURISTICS, defaultHeuristicConfig } from './modules/heuristics.js';
import { BOTS, getBot, getBotRecord, recordGameResult, resetBotRecords } from './modules/bots.js';
import { key as cellKey } from './modules/coords.js';
import { MAX_LOOKAHEAD_WITH_PRUNING, MAX_LOOKAHEAD_WITHOUT_PRUNING } from './modules/ai.js';
import { askWorker, resetWorker } from './modules/workerClient.js';
import { runBatch } from './modules/batchRunner.js';
import { runOptimizer } from './modules/optimizer.js';
import { saveBatchResult, getBatchHistory, clearBatchHistory } from './modules/batchHistory.js';

function makeDefaultAiConfig() {
  return { lookahead: 3, alphaBeta: true, caching: true, openingBook: true, heuristics: defaultHeuristicConfig() };
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

let dom = {};

// ======================================================================
// View / mode management
// ======================================================================
let currentView = 'watch'; // 'watch' | 'play' | 'batch'

function setView(view) {
  currentView = view;
  dom.modeButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === view));
  dom.watchPlayActions.hidden = view === 'batch';
  dom.batchActions.hidden = view !== 'batch';
  dom.gameView.hidden = view === 'batch';
  dom.batchView.hidden = view !== 'batch';
  if (view === 'watch' || view === 'play') {
    state.setMode(view);
    updateOpponentLabel();
  }
  render();
}

function updateOpponentLabel() {
  dom.opponentLabel.textContent = getBot(state.getBotLevel()).name;
}

// ======================================================================
// AI Settings modal - retargeted to edit whichever config is currently active
// ======================================================================
let modalTarget = null; // { getConfig, setConfig }

function buildHeuristicsControls(container) {
  container.innerHTML = '';
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
    container.appendChild(row);
    const checkbox = row.querySelector(`#h-${h.key}-enabled`);
    const slider = row.querySelector(`#h-${h.key}-weight`);
    checkbox.addEventListener('change', () => {
      const cfg = modalTarget.getConfig();
      modalTarget.setConfig({ heuristics: { ...cfg.heuristics, [h.key]: { ...cfg.heuristics[h.key], enabled: checkbox.checked } } });
    });
    slider.addEventListener('input', () => {
      const cfg = modalTarget.getConfig();
      modalTarget.setConfig({ heuristics: { ...cfg.heuristics, [h.key]: { ...cfg.heuristics[h.key], weight: Number(slider.value) } } });
    });
  }
}

function syncModalFromConfig() {
  const cfg = modalTarget.getConfig();
  dom.modalAlphaBeta.checked = cfg.alphaBeta;
  dom.modalCaching.checked = cfg.caching;
  dom.modalOpeningBook.checked = cfg.openingBook;

  const maxDepth = cfg.alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
  dom.modalLookaheadSlider.max = String(maxDepth);
  dom.modalLookaheadSlider.value = String(Math.min(cfg.lookahead, maxDepth));
  dom.modalLookaheadValue.textContent = dom.modalLookaheadSlider.value;
  dom.modalLookaheadNote.textContent = cfg.alphaBeta
    ? ''
    : `Without alpha-beta pruning, full minimax must explore every branch, so lookahead is capped at ${MAX_LOOKAHEAD_WITHOUT_PRUNING} to stay responsive.`;

  for (const h of Object.values(HEURISTICS)) {
    document.getElementById(`h-${h.key}-enabled`).checked = cfg.heuristics[h.key].enabled;
    document.getElementById(`h-${h.key}-weight`).value = String(cfg.heuristics[h.key].weight);
  }
}

function openAiSettingsModal(title, getConfig, setConfig) {
  modalTarget = { getConfig, setConfig };
  dom.aiSettingsModalTitle.textContent = title;
  syncModalFromConfig();
  dom.aiSettingsModal.showModal();
}

function wireAiSettingsModal() {
  buildHeuristicsControls(dom.modalHeuristics);

  dom.modalLookaheadSlider.addEventListener('input', () => {
    dom.modalLookaheadValue.textContent = dom.modalLookaheadSlider.value;
    modalTarget.setConfig({ lookahead: Number(dom.modalLookaheadSlider.value) });
  });
  dom.modalAlphaBeta.addEventListener('change', () => {
    const alphaBeta = dom.modalAlphaBeta.checked;
    const maxDepth = alphaBeta ? MAX_LOOKAHEAD_WITH_PRUNING : MAX_LOOKAHEAD_WITHOUT_PRUNING;
    modalTarget.setConfig({ alphaBeta, lookahead: Math.min(modalTarget.getConfig().lookahead, maxDepth) });
    syncModalFromConfig();
  });
  dom.modalCaching.addEventListener('change', () => modalTarget.setConfig({ caching: dom.modalCaching.checked }));
  dom.modalOpeningBook.addEventListener('change', () => modalTarget.setConfig({ openingBook: dom.modalOpeningBook.checked }));
  dom.modalResetBtn.addEventListener('click', () => {
    modalTarget.setConfig(makeDefaultAiConfig());
    syncModalFromConfig();
  });
  dom.modalCloseBtn.addEventListener('click', () => dom.aiSettingsModal.close());

  dom.aiSettingsBtn.addEventListener('click', () => {
    openAiSettingsModal('AI Settings', () => state.getAiConfig(), (partial) => state.setAiConfig(partial));
  });
}

// ======================================================================
// Opponent-picker modal - reused for watch/play and batch-vs-bot
// ======================================================================
function openOpponentModal(onSelect) {
  dom.opponentList.innerHTML = '';
  for (const bot of BOTS) {
    const record = getBotRecord(bot.level);
    const card = document.createElement('div');
    card.className = 'opponent-card';
    card.innerHTML = `
      <div class="opponent-card-head">
        <strong>${bot.level}. ${bot.name}</strong>
        <span class="opponent-record">${record.wins}W – ${record.losses}L</span>
      </div>
      <p class="opponent-desc">${describeAiConfig(bot.aiConfig)} Random-move chance: ${Math.round(bot.noise * 100)}%.</p>
      <button type="button" class="action-btn opponent-select-btn">Select ${bot.name}</button>
    `;
    card.querySelector('.opponent-select-btn').addEventListener('click', () => {
      onSelect(bot.level);
      dom.opponentModal.close();
    });
    dom.opponentList.appendChild(card);
  }
  dom.opponentModal.showModal();
}

function wireOpponentModal() {
  dom.opponentModalCloseBtn.addEventListener('click', () => dom.opponentModal.close());
  dom.opponentBtn.addEventListener('click', () => {
    openOpponentModal((level) => {
      state.setBotLevel(level);
      updateOpponentLabel();
    });
  });
}

// ======================================================================
// Watch / Play game loop (mostly unchanged from v1)
// ======================================================================
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

async function advanceGame() {
  if (currentView === 'batch') return;
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
  recordGameResult(state.getBotLevel(), winner === relevantColor);
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
  if (currentView === 'batch') return;
  renderStatus();
  renderBoardSvg();
  renderCaptured();
  renderThinking();
  renderHistory();
}

function renderStatus() {
  const status = state.getStatus();
  const el = dom.gameStatus;
  el.className = status === 'gameover' ? 'status-gameover' : 'status-normal';
  if (status === 'idle') {
    el.textContent = 'Press New Game to begin.';
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
  dom.capturedBlack.textContent = `${bLost}/6`;
  dom.capturedWhite.textContent = `${wLost}/6`;
}

function renderThinking() {
  const status = state.getStatus();
  const stats = state.getLastStats();
  dom.thinkingTurn.textContent = `${colorName(state.getTurn())} (${actorLabel(state.getTurn())})`;
  if (status === 'thinking') {
    ['thinkingNodes', 'thinkingCache', 'thinkingCacheSize', 'thinkingScore', 'thinkingDepth', 'thinkingSource', 'thinkingPv'].forEach(
      (k) => (dom[k].textContent = '...')
    );
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

// ======================================================================
// Batch Run mode
// ======================================================================
let batchOpponentType = 'bot'; // 'bot' | 'custom' | 'optimize'
let batchBotLevel = 1;
let batchAiConfigA = makeDefaultAiConfig();
let batchAiConfigB = makeDefaultAiConfig();
let optimizerBaselineConfig = makeDefaultAiConfig();
let batchRunning = false;
let batchCancelRequested = false;

function updateBatchBotLabel() {
  dom.batchBotLabel.textContent = getBot(batchBotLevel).name;
}

function wireBatchControls() {
  dom.batchOpponentType.querySelectorAll('.segmented-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      batchOpponentType = btn.dataset.value;
      dom.batchOpponentType.querySelectorAll('.segmented-btn').forEach((b) => b.classList.toggle('active', b === btn));
      dom.aiASettingsBtn.hidden = batchOpponentType === 'optimize';
      dom.aiBaselineSettingsBtn.hidden = batchOpponentType !== 'optimize';
      dom.batchOpponentBtn.hidden = batchOpponentType === 'custom';
      dom.aiBSettingsBtn.hidden = batchOpponentType !== 'custom';
      dom.numGamesLabel.hidden = batchOpponentType === 'optimize';
      dom.optimizerOnlyInputs.forEach((el) => (el.hidden = batchOpponentType !== 'optimize'));
      dom.runBatchBtn.textContent = batchOpponentType === 'optimize' ? '🔬 Find Best AI' : '▶ Run Batch';
    });
  });

  dom.aiASettingsBtn.addEventListener('click', () => {
    openAiSettingsModal('Configure AI A', () => batchAiConfigA, (partial) => {
      batchAiConfigA = { ...batchAiConfigA, ...partial };
    });
  });
  dom.aiBSettingsBtn.addEventListener('click', () => {
    openAiSettingsModal('Configure AI B', () => batchAiConfigB, (partial) => {
      batchAiConfigB = { ...batchAiConfigB, ...partial };
    });
  });
  dom.aiBaselineSettingsBtn.addEventListener('click', () => {
    openAiSettingsModal('Configure baseline', () => optimizerBaselineConfig, (partial) => {
      optimizerBaselineConfig = { ...optimizerBaselineConfig, ...partial };
    });
  });
  dom.batchOpponentBtn.addEventListener('click', () => {
    openOpponentModal((level) => {
      batchBotLevel = level;
      updateBatchBotLabel();
    });
  });

  dom.runBatchBtn.addEventListener('click', () => {
    if (batchOpponentType === 'optimize') startOptimizerRun();
    else startBatchRun();
  });
  dom.cancelBatchBtn.addEventListener('click', () => {
    batchCancelRequested = true;
  });
  dom.clearBatchHistoryBtn.addEventListener('click', () => {
    clearBatchHistory();
    renderBatchHistory();
  });
  dom.useBestConfigBtn.addEventListener('click', () => {
    if (lastOptimizerResult) {
      state.setAiConfig(lastOptimizerResult.bestConfig);
      dom.useBestConfigBtn.textContent = '✓ Applied to your AI Settings';
      setTimeout(() => (dom.useBestConfigBtn.textContent = '✓ Use this as my AI Settings'), 2000);
    }
  });
}

async function startBatchRun() {
  if (batchRunning) return;
  const numGames = Math.max(1, Math.min(100, Number(dom.numGamesInput.value) || 10));
  batchRunning = true;
  batchCancelRequested = false;
  resetWorker();

  dom.runBatchBtn.hidden = true;
  dom.cancelBatchBtn.hidden = false;
  dom.batchProgress.hidden = false;
  dom.batchResults.hidden = true;
  dom.batchProgressFill.style.width = '0%';
  dom.batchProgressText.textContent = `Game 0 of ${numGames}…`;

  const labelA = 'AI A';
  const labelB = batchOpponentType === 'bot' ? `Bot: ${getBot(batchBotLevel).name}` : 'AI B';

  const summary = await runBatch({
    mode: batchOpponentType,
    botLevel: batchBotLevel,
    aiConfigA: batchAiConfigA,
    aiConfigB: batchAiConfigB,
    numGames,
    onProgress: (done, total) => {
      dom.batchProgressText.textContent = `Game ${done} of ${total}…`;
      dom.batchProgressFill.style.width = `${(done / total) * 100}%`;
    },
    isCancelled: () => batchCancelRequested,
  });

  if (batchOpponentType === 'bot') {
    for (const g of summary.perGame) recordGameResult(batchBotLevel, g.winnerSide === 'A');
  }

  const saved = saveBatchResult({
    ...summary,
    type: 'batch',
    labelA,
    labelB,
    descA: describeAiConfig(batchAiConfigA),
    descB: batchOpponentType === 'bot' ? describeAiConfig(getBot(batchBotLevel).aiConfig) : describeAiConfig(batchAiConfigB),
  });

  batchRunning = false;
  dom.runBatchBtn.hidden = false;
  dom.cancelBatchBtn.hidden = true;
  dom.batchProgress.hidden = true;

  dom.optimizeResults.hidden = true;
  renderBatchResults(saved);
  renderBatchHistory();
}

let lastOptimizerResult = null;

async function startOptimizerRun() {
  if (batchRunning) return;
  const rounds = Math.max(1, Math.min(15, Number(dom.optimizerRoundsInput.value) || 5));
  const candidatesPerRound = Math.max(1, Math.min(8, Number(dom.optimizerCandidatesInput.value) || 4));
  const gamesPerCandidate = Math.max(1, Math.min(20, Number(dom.optimizerGamesInput.value) || 6));
  const totalConfigs = 1 + rounds * candidatesPerRound;

  batchRunning = true;
  batchCancelRequested = false;
  resetWorker();

  dom.runBatchBtn.hidden = true;
  dom.cancelBatchBtn.hidden = false;
  dom.batchProgress.hidden = false;
  dom.batchResults.hidden = true;
  dom.optimizeResults.hidden = true;
  dom.batchProgressFill.style.width = '0%';
  dom.batchProgressText.textContent = `Testing baseline…`;

  let configsTested = 0;
  const result = await runOptimizer({
    baselineConfig: optimizerBaselineConfig,
    botLevel: batchBotLevel,
    rounds,
    candidatesPerRound,
    gamesPerCandidate,
    onProgress: ({ round, rounds: totalRounds, candidateIndex, candidatesPerRound: perRound, current }) => {
      configsTested += 1;
      dom.batchProgressText.textContent =
        round === 0
          ? `Baseline: ${Math.round(current.winRate * 100)}% win rate`
          : `Round ${round}/${totalRounds}, candidate ${candidateIndex}/${perRound} — best so far ${Math.round(current.winRate * 100)}%`;
      dom.batchProgressFill.style.width = `${(configsTested / totalConfigs) * 100}%`;
    },
    isCancelled: () => batchCancelRequested,
  });

  lastOptimizerResult = result;
  const saved = saveBatchResult({
    type: 'optimize',
    labelA: 'Baseline',
    labelB: `Bot: ${getBot(batchBotLevel).name}`,
    botLevel: batchBotLevel,
    bestConfig: result.bestConfig,
    bestWinRate: result.bestWinRate,
    bestLabel: result.bestLabel,
    numGamesCompleted: result.history.reduce((sum, h) => sum + h.gamesPlayed, 0),
    configsTested: result.history.length,
    history: result.history,
    insights: result.insights,
  });

  batchRunning = false;
  dom.runBatchBtn.hidden = false;
  dom.cancelBatchBtn.hidden = true;
  dom.batchProgress.hidden = true;

  renderOptimizeResults(saved);
  renderBatchHistory();
}

// --- Batch results: stat tiles + bar chart ---
// Palette per dataviz skill guidance: reference palette, categorical slots 1
// (blue) & 2 (aqua) in fixed order for the two competing sides, muted gray
// for the non-competing "timeout" outcome.
function statTile(label, value) {
  return `<div class="stat-tile"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}

function renderBatchResults(summary) {
  dom.batchResults.hidden = false;
  const total = summary.numGamesCompleted || 1;
  const winRateA = Math.round((summary.winsA / total) * 100);

  dom.batchStatTiles.innerHTML = [
    statTile('Games played', `${summary.numGamesCompleted}${summary.timeouts ? ` (${summary.timeouts} timed out)` : ''}`),
    statTile('Win rate — A', `${winRateA}%`),
    statTile('Avg game length', `${Math.round(summary.avgPlies)} plies`),
    statTile('Avg think time', `A ${formatMs(summary.avgTimeA)} · B ${formatMs(summary.avgTimeB)}`),
    statTile('Avg positions searched', `A ${Math.round(summary.avgNodesA).toLocaleString()} · B ${Math.round(summary.avgNodesB).toLocaleString()}`),
  ].join('');

  renderWinBarChart(dom.batchChartContainer, summary);
}

function renderWinBarChart(container, summary) {
  const rows = [
    { label: summary.labelA, value: summary.winsA, colorVar: '--series-a' },
    { label: summary.labelB, value: summary.winsB, colorVar: '--series-b' },
  ];
  if (summary.timeouts > 0) rows.push({ label: 'Timed out', value: summary.timeouts, colorVar: '--series-timeout' });

  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  const barH = 24;
  const gap = 14;
  const chartW = 420;
  const labelW = 130;
  const trackW = chartW - labelW - 40;
  const svgH = rows.length * (barH + gap) + gap;

  const bars = rows
    .map((r, i) => {
      const y = gap + i * (barH + gap);
      const w = Math.max(2, (r.value / maxVal) * trackW);
      return `
        <text x="0" y="${y + barH / 2 + 4}" class="viz-cat-label">${r.label}</text>
        <rect x="${labelW}" y="${y}" width="${trackW}" height="${barH}" rx="4" class="viz-track"></rect>
        <rect x="${labelW}" y="${y}" width="${w}" height="${barH}" rx="4" fill="var(${r.colorVar})"></rect>
        <text x="${labelW + w + 8}" y="${y + barH / 2 + 4}" class="viz-value-label">${r.value}</text>
      `;
    })
    .join('');

  container.innerHTML = `
    <svg class="viz-root batch-bar-chart" viewBox="0 0 ${chartW} ${svgH}" role="img" aria-label="Wins per side">
      ${bars}
    </svg>
  `;
}

// --- Optimize results: stat tiles + insights bars + ranked config list ---
function insightBar(label, stat) {
  const onPct = Math.round(stat.onAvg * 100);
  const offPct = Math.round(stat.offAvg * 100);
  return `
    <div class="insight-row">
      <div class="insight-label">${label}</div>
      <div class="insight-bars">
        <div class="insight-bar-line"><span>On (${stat.onCount})</span><div class="insight-track"><div class="insight-fill on" style="width:${onPct}%"></div></div><strong>${onPct}%</strong></div>
        <div class="insight-bar-line"><span>Off (${stat.offCount})</span><div class="insight-track"><div class="insight-fill off" style="width:${offPct}%"></div></div><strong>${offPct}%</strong></div>
      </div>
    </div>
  `;
}

function renderOptimizeResults(run) {
  dom.batchResults.hidden = true;
  dom.optimizeResults.hidden = false;

  dom.optimizeStatTiles.innerHTML = [
    statTile('Best win rate', `${Math.round(run.bestWinRate * 100)}%`),
    statTile('Configs tested', run.configsTested),
    statTile('Total games played', run.numGamesCompleted),
    statTile('Best config found in', run.bestLabel || '-'),
  ].join('');

  const insights = run.insights;
  dom.optimizeInsights.innerHTML = [
    insightBar('Alpha-beta pruning', insights.alphaBeta),
    insightBar('Caching', insights.caching),
    insightBar('Opening principles', insights.openingBook),
    ...Object.entries(insights.heuristics).map(([key, stat]) => insightBar(HEURISTICS[key]?.label || key, stat)),
  ].join('');

  const ranked = [...run.history].sort((a, b) => b.winRate - a.winRate);
  dom.optimizeRankedList.innerHTML = ranked
    .map(
      (entry, i) => `
      <div class="ranked-row ${i === 0 ? 'best' : ''}">
        <div class="ranked-rank">${i === 0 ? '🏆' : `#${i + 1}`}</div>
        <div class="ranked-body">
          <div class="ranked-head"><strong>${Math.round(entry.winRate * 100)}% win rate</strong><span>${entry.label}</span></div>
          <p class="ranked-desc">${describeAiConfig(entry.config)}</p>
        </div>
      </div>
    `
    )
    .join('');
}

function renderBatchHistory() {
  const history = getBatchHistory();
  if (history.length === 0) {
    dom.batchHistoryList.innerHTML = '<div class="history-empty">No batch runs yet</div>';
    return;
  }
  dom.batchHistoryList.innerHTML = history
    .map((run) => {
      const date = new Date(run.timestamp).toLocaleString();
      if (run.type === 'optimize') {
        return `
          <div class="batch-history-row" data-id="${run.id}">
            <div><strong>${date}</strong> — 🔬 Find best settings vs ${run.labelB}</div>
            <div>${run.configsTested} configs tested · best ${Math.round(run.bestWinRate * 100)}% win rate</div>
          </div>
        `;
      }
      const total = run.numGamesCompleted || 1;
      const winRateA = Math.round((run.winsA / total) * 100);
      const opponent = run.mode === 'bot' ? run.labelB : `${run.labelA} vs ${run.labelB}`;
      return `
        <div class="batch-history-row" data-id="${run.id}">
          <div><strong>${date}</strong> — ${opponent}</div>
          <div>${run.numGamesCompleted} games · A won ${winRateA}% · avg ${Math.round(run.avgPlies)} plies</div>
        </div>
      `;
    })
    .join('');
  dom.batchHistoryList.querySelectorAll('.batch-history-row').forEach((row) => {
    row.addEventListener('click', () => {
      const run = history.find((r) => r.id === row.dataset.id);
      if (!run) return;
      if (run.type === 'optimize') {
        lastOptimizerResult = { bestConfig: run.bestConfig };
        renderOptimizeResults(run);
      } else {
        dom.optimizeResults.hidden = true;
        renderBatchResults(run);
      }
    });
  });
}

// ======================================================================
// Setup
// ======================================================================
function wireTopLevel() {
  dom.modeButtons.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.mode)));

  dom.newGameBtn.addEventListener('click', () => {
    resetWorker();
    state.newGame({ mode: currentView === 'play' ? 'play' : 'watch', botLevel: state.getBotLevel(), humanColor: 'b', aiColor: 'b' });
    render();
    advanceGame();
  });

  state.subscribe((eventType) => {
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
}

document.addEventListener('DOMContentLoaded', () => {
  dom = {
    modeButtons: document.querySelectorAll('.mode-btn'),
    watchPlayActions: document.getElementById('watch-play-actions'),
    batchActions: document.getElementById('batch-actions'),
    gameView: document.getElementById('game-view'),
    batchView: document.getElementById('batch-view'),

    aiSettingsBtn: document.getElementById('ai-settings-btn'),
    opponentBtn: document.getElementById('opponent-btn'),
    opponentLabel: document.getElementById('opponent-label'),
    newGameBtn: document.getElementById('new-game-btn'),

    batchOpponentType: document.getElementById('batch-opponent-type'),
    aiASettingsBtn: document.getElementById('ai-a-settings-btn'),
    aiBSettingsBtn: document.getElementById('ai-b-settings-btn'),
    aiBaselineSettingsBtn: document.getElementById('ai-baseline-settings-btn'),
    batchOpponentBtn: document.getElementById('batch-opponent-btn'),
    batchBotLabel: document.getElementById('batch-bot-label'),
    numGamesLabel: document.getElementById('num-games-label'),
    numGamesInput: document.getElementById('num-games-input'),
    optimizerOnlyInputs: document.querySelectorAll('.optimizer-only'),
    optimizerRoundsInput: document.getElementById('optimizer-rounds-input'),
    optimizerCandidatesInput: document.getElementById('optimizer-candidates-input'),
    optimizerGamesInput: document.getElementById('optimizer-games-input'),
    runBatchBtn: document.getElementById('run-batch-btn'),
    cancelBatchBtn: document.getElementById('cancel-batch-btn'),

    gameStatus: document.getElementById('game-status'),
    svg: document.getElementById('board'),
    capturedBlack: document.getElementById('marbles-lost-black'),
    capturedWhite: document.getElementById('marbles-lost-white'),
    thinkingTurn: document.getElementById('thinking-turn'),
    thinkingTime: document.getElementById('thinking-time'),
    thinkingNodes: document.getElementById('thinking-nodes'),
    thinkingCache: document.getElementById('thinking-cache'),
    thinkingCacheSize: document.getElementById('thinking-cache-size'),
    thinkingScore: document.getElementById('thinking-score'),
    thinkingDepth: document.getElementById('thinking-depth'),
    thinkingSource: document.getElementById('thinking-source'),
    thinkingPv: document.getElementById('thinking-pv'),
    moveHistory: document.getElementById('move-history'),

    batchProgress: document.getElementById('batch-progress'),
    batchProgressText: document.getElementById('batch-progress-text'),
    batchProgressFill: document.getElementById('batch-progress-fill'),
    batchResults: document.getElementById('batch-results'),
    batchStatTiles: document.getElementById('batch-stat-tiles'),
    batchChartContainer: document.getElementById('batch-chart-container'),
    optimizeResults: document.getElementById('optimize-results'),
    optimizeStatTiles: document.getElementById('optimize-stat-tiles'),
    optimizeInsights: document.getElementById('optimize-insights'),
    optimizeRankedList: document.getElementById('optimize-ranked-list'),
    useBestConfigBtn: document.getElementById('use-best-config-btn'),
    batchHistoryList: document.getElementById('batch-history-list'),
    clearBatchHistoryBtn: document.getElementById('clear-batch-history-btn'),

    aiSettingsModal: document.getElementById('ai-settings-modal'),
    aiSettingsModalTitle: document.getElementById('ai-settings-modal-title'),
    modalLookaheadSlider: document.getElementById('modal-lookahead-slider'),
    modalLookaheadValue: document.getElementById('modal-lookahead-value'),
    modalLookaheadNote: document.getElementById('modal-lookahead-note'),
    modalAlphaBeta: document.getElementById('modal-alpha-beta-toggle'),
    modalCaching: document.getElementById('modal-caching-toggle'),
    modalOpeningBook: document.getElementById('modal-opening-book-toggle'),
    modalHeuristics: document.getElementById('modal-heuristics-controls'),
    modalResetBtn: document.getElementById('modal-reset-ai-btn'),
    modalCloseBtn: document.getElementById('modal-close-btn'),

    opponentModal: document.getElementById('opponent-modal'),
    opponentList: document.getElementById('opponent-list'),
    opponentModalCloseBtn: document.getElementById('opponent-modal-close-btn'),
  };

  wireAiSettingsModal();
  wireOpponentModal();
  wireBatchControls();
  wireTopLevel();

  state.setAiConfig(makeDefaultAiConfig());
  state.setBotLevel(1);
  updateOpponentLabel();
  updateBatchBotLabel();
  renderBatchHistory();

  state.newGame({ mode: 'watch', botLevel: 1, humanColor: 'b', aiColor: 'b' });
  setView('watch');
});
