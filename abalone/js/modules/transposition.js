// transposition.js - simple position cache. Uses a plain serialized board+turn
// string as the key rather than Zobrist hashing: slightly more memory per key,
// but trivially correct (no hash-collision risk) which matters more at this scale.
export function createTranspositionTable(maxEntries = 200000) {
  const map = new Map();
  return {
    get(k) {
      return map.get(k);
    },
    set(k, entry) {
      if (!map.has(k) && map.size >= maxEntries) {
        map.delete(map.keys().next().value); // evict oldest insertion
      }
      map.set(k, entry);
    },
    get size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
  };
}

// Boards are fixed-length arrays indexed by coords.idx(q,r), so a plain join
// is already a stable, cheap, collision-free serialization (unused slots
// stringify to '' consistently since they're always undefined).
export function boardKey(board, turnColor) {
  return board.join('') + turnColor;
}
