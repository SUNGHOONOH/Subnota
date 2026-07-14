import { hashText } from '../../../lib/contentHash';

// Stable 32-bit seed from any key (reuses the app's FNV-1a hash).
export const seedFrom = (key: string): number => parseInt(hashText(key), 36) >>> 0;

// mulberry32 — tiny deterministic PRNG. Returns a function yielding [0, 1).
// stdlib has no seeded RNG; this is the minimal correct one.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const seededRandom = (key: string) => mulberry32(seedFrom(key));

// The deterministic seed key for a user's tree of a given generation.
// Same user + generation => same tree, forever (generation bumps on planting).
export const treeSeedKey = (userId: string, generation = 0): string =>
  `${userId}:tree:${generation}:pixel-tree:v1`;
