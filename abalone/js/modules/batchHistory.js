// batchHistory.js - persists past batch-run results to localStorage so they
// survive a page reload. Keeps the most recent MAX_ENTRIES only.
const STORAGE_KEY = 'abalone-batch-history-v1';
const MAX_ENTRIES = 20;

function hasStorage() {
  return typeof localStorage !== 'undefined';
}

export function getBatchHistory() {
  if (!hasStorage()) return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

// summary: the object returned by batchRunner.runBatch(), plus labelA/labelB
// (human-readable descriptions of what each side was, supplied by the caller).
export function saveBatchResult(summary) {
  if (!hasStorage()) return summary;
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now(), ...summary };
  const history = [entry, ...getBatchHistory()].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore (private browsing, storage disabled, quota, etc.)
  }
  return entry;
}

export function clearBatchHistory() {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
