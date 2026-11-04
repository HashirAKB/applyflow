// Choose which visible option of a select / radio group represents a stored answer.
// Returns -1 when no option clearly matches; the caller then asks the user instead of guessing.

import { similarity } from './fuzzy';
import { normalize } from './text';

const YES = ['yes', 'y', 'true', 'i do', 'i am', 'i will', 'i agree', 'agree', 'authorized', 'willing'];
const NO = ['no', 'n', 'false', 'i do not', 'i dont', 'i am not', 'not', 'decline', 'unwilling'];

function polarity(s: string): 'yes' | 'no' | null {
  const n = normalize(s);
  if (YES.some((y) => n === y || n.startsWith(y + ' '))) return 'yes';
  if (NO.some((x) => n === x || n.startsWith(x + ' '))) return 'no';
  return null;
}

export function matchOption(value: string, options: string[]): number {
  const v = normalize(value);
  if (!v) return -1;
  const norm = options.map(normalize);

  const exact = norm.indexOf(v);
  if (exact >= 0) return exact;

  // Yes/No answers against "Yes, I am authorised" style options.
  const p = polarity(value);
  if (p) {
    const hits = options.map((o, i) => (polarity(o) === p ? i : -1)).filter((i) => i >= 0);
    if (hits.length === 1) return hits[0];
  }

  // Option text contained in the answer or vice versa ("India" vs "India (+91)"), only if unique.
  const contains = norm.map((o, i) => (o && (o.includes(v) || v.includes(o)) ? i : -1)).filter((i) => i >= 0);
  if (contains.length === 1) return contains[0];

  let best = -1;
  let bestScore = 0;
  let second = 0;
  options.forEach((o, i) => {
    const s = similarity(value, o);
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      best = i;
    } else if (s > second) second = s;
  });
  // Require a clear winner, not just the least bad option.
  return bestScore >= 0.8 && bestScore - second >= 0.1 ? best : -1;
}
