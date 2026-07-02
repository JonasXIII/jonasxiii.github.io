// workerClient.js - a single shared search worker + request/response plumbing.
// Both the live game (main.js) and batch simulations (batchRunner.js) go
// through this one worker so its per-config transposition-table cache is
// reused rather than duplicated across two separate worker threads.
let worker = null;
const pending = new Map();
let reqCounter = 0;

function ensureWorker() {
  if (!worker) {
    worker = new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const { requestId, move, stats } = e.data;
      const resolve = pending.get(requestId);
      if (resolve) {
        pending.delete(requestId);
        resolve({ move, stats });
      }
    };
  }
  return worker;
}

export function askWorker(msg) {
  const w = ensureWorker();
  return new Promise((resolve) => {
    const requestId = ++reqCounter;
    pending.set(requestId, resolve);
    w.postMessage({ ...msg, requestId });
  });
}

export function resetWorker() {
  ensureWorker().postMessage({ type: 'reset' });
}
