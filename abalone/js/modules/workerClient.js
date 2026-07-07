// workerClient.js - a small pool of search workers + request/response plumbing.
// The live game only ever needs one worker (moves are inherently sequential),
// but batch/optimizer runs play many independent games and benefit from
// spreading them across several worker threads - askWorkerOn(slot, msg) lets
// a caller pin a sequence of requests (one game's worth of moves) to a
// specific worker so that worker's per-config transposition-table cache stays
// warm across that game's moves.
const pool = []; // { worker, pending: Map, reqCounter }

function poolSize() {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 0;
  return Math.max(1, Math.min(4, cores ? cores - 1 : 2));
}

function ensurePool() {
  if (pool.length === 0) {
    const size = poolSize();
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('./searchWorker.js', import.meta.url), { type: 'module' });
      const entry = { worker, pending: new Map(), reqCounter: 0 };
      worker.onmessage = (e) => {
        const { requestId, move, stats } = e.data;
        const resolve = entry.pending.get(requestId);
        if (resolve) {
          entry.pending.delete(requestId);
          resolve({ move, stats });
        }
      };
      pool.push(entry);
    }
  }
  return pool;
}

export function getPoolSize() {
  return ensurePool().length;
}

export function askWorkerOn(slot, msg) {
  const workers = ensurePool();
  const entry = workers[slot % workers.length];
  return new Promise((resolve) => {
    const requestId = ++entry.reqCounter;
    entry.pending.set(requestId, resolve);
    entry.worker.postMessage({ ...msg, requestId });
  });
}

export function askWorker(msg) {
  return askWorkerOn(0, msg);
}

export function resetWorker() {
  for (const entry of ensurePool()) entry.worker.postMessage({ type: 'reset' });
}
