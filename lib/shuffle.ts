// Fisher–Yates (Knuth) shuffling utilities.

/** Uniform random integer in [0, maxExclusive) — uses crypto when available. */
export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const c = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    // Rejection sampling to avoid modulo bias.
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    const buf = new Uint32Array(1);
    let x: number;
    do {
      c.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    return x % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

/** Returns a NEW array with the elements of `input` in uniformly random order. */
export function shuffle<T>(input: readonly T[], rand: (n: number) => number = randomInt): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/** Random permutation of [0, 1, ..., n-1]. */
export function shuffledIndices(n: number): number[] {
  return shuffle(Array.from({ length: n }, (_, i) => i));
}

/**
 * Shuffles a question's options. Returns `order` where order[displayIndex] = originalIndex,
 * plus the remapped correct display index.
 */
export function shuffleOptions(optionCount: number, correctIndex: number) {
  const order = shuffledIndices(optionCount);
  return { order, correctDisplayIndex: order.indexOf(correctIndex) };
}

