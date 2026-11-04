// Small text helpers shared by matching, option selection and label cleanup.

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove required markers and trailing punctuation that sites put on labels. */
export function cleanLabel(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\(\s*(required|optional)\s*\)/gi, '')
    .replace(/[*✱]+/g, '')
    .replace(/\s*[:?]\s*$/, (m) => (m.includes('?') ? '?' : ''))
    .trim();
}

const STOP = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'is', 'are', 'you', 'your', 'do', 'does',
  'what', 'please', 'with', 'be', 'if', 'any', 'have', 'at', 'this', 'that', 'we', 'us', 'our', 'can', 'will', 'as',
  'by', 'it', 'from', 'enter', 'provide', 'select', 'how', 'which', 'would', 'currently',
]);

/** Very light stemmer: enough to make "relocating" ~ "relocate" and "years" ~ "year". */
export function stem(w: string): string {
  if (w.length <= 4) return w;
  return w.replace(/(ing|ed|es|s|ion|ions|ation|ations)$/, '') || w;
}

export function tokens(s: string): string[] {
  return normalize(s)
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}
