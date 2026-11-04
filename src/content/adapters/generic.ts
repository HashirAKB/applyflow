// Heuristic adapter for any site without a dedicated one.
import type { SiteAdapter } from './types';
import { buttonByText, clip, meta, textOf } from './common';
import { isVisible } from '../detect';

const FILLABLE = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';

export const generic: SiteAdapter = {
  id: 'generic',
  name: 'Any site (heuristic)',
  verification: 'fixture-tested',
  matches: () => true,
  formRoot(doc) {
    // The form with the most visible fillable controls. Falls back to body for formless SPAs.
    const forms = Array.from(doc.querySelectorAll('form'));
    const score = (f: Element) => Array.from(f.querySelectorAll(FILLABLE)).filter(isVisible).length;
    const best = forms.sort((a, b) => score(b) - score(a))[0];
    return best && score(best) > 0 ? best : doc.body;
  },
  jobInfo(doc) {
    const title = textOf(doc.querySelector('h1')) || meta(doc, 'og:title') || doc.title;
    const company = meta(doc, 'og:site_name') || doc.title.split(/[|\-–@]/).pop()?.trim() || '';
    const description = textOf(doc.querySelector('[class*="description" i], [id*="description" i], article, main'));
    return { company, role: title, description: clip(description) };
  },
  submitButton: (root) =>
    root.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]') ?? buttonByText(root, /^(submit|apply|send application)/i),
  nextButton: (root) => buttonByText(root, /^(next|continue|save and continue|review)\b/i),
};
