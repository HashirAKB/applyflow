// String similarity tuned for short form labels. Two signals, averaged with weights:
// - token Jaccard on stemmed, stop-word-free tokens (word overlap)
// - character trigram Dice (robust to typos and word-form differences)

import { normalize, tokens } from './text';

export function tokenJaccard(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

function trigrams(s: string): Map<string, number> {
  const t = ` ${normalize(s)} `;
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 2; i++) {
    const g = t.slice(i, i + 3);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

export function trigramDice(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    inter += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return total ? (2 * inter) / total : 0;
}

/** 0..1 similarity between two labels. */
export function similarity(a: string, b: string): number {
  if (normalize(a) === normalize(b)) return 1;
  return 0.6 * tokenJaccard(a, b) + 0.4 * trigramDice(a, b);
}
