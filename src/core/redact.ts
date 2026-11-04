// Redaction for "report a broken site". The export must be useful for fixing an adapter (structure,
// labels, attributes) while containing none of the user's personal values.

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
const PHONE = /\+?\d[\d\s().-]{7,}\d/g;
const LONG_NUMBER = /\b\d{5,}\b/g;

/** Values to scrub: every non-trivial string in the profile and answer bank. */
export function secretsFrom(values: unknown): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length >= 3) out.add(t);
      // Also individual words of multi-word values (a name shown as "Ada" elsewhere on the page).
      for (const w of t.split(/[\s,/|]+/)) if (w.length >= 4 && !/^(https?:|www\.)/.test(w)) out.add(w);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(values);
  // Longest first so "Ada Lovelace" is replaced before "Ada".
  return [...out].sort((a, b) => b.length - a.length);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scrubText(text: string, secrets: string[]): string {
  let t = text;
  for (const s of secrets) t = t.replace(new RegExp(escapeRe(s), 'gi'), '[redacted]');
  return t.replace(EMAIL, '[email]').replace(PHONE, '[phone]').replace(LONG_NUMBER, '[number]');
}

const KEEP_ATTRS = /^(id|class|name|type|role|for|required|disabled|readonly|multiple|accept|placeholder|title|alt|href|action|method|hidden|style|aria-[\w-]+|data-[\w-]+)$/;

/** Redact a DOM subtree in place (call it on a clone). */
export function redactTree(root: Element, secrets: string[]): void {
  root.querySelectorAll('script, style, noscript, svg, iframe, img, video, audio, canvas, link, meta').forEach((n) => n.remove());
  const all = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const el of all) {
    if (el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true') el.textContent = '';
    if (el.tagName === 'OPTION') el.removeAttribute('selected');
    for (const attr of Array.from(el.attributes)) {
      if (!KEEP_ATTRS.test(attr.name) || attr.name.startsWith('data-applyflow')) {
        el.removeAttribute(attr.name);
        continue;
      }
      let v = attr.value;
      if (attr.name === 'href' || attr.name === 'action') v = v.split(/[?#]/)[0];
      el.setAttribute(attr.name, scrubText(v, secrets));
    }
  }
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) n.nodeValue = scrubText(n.nodeValue ?? '', secrets);
}
