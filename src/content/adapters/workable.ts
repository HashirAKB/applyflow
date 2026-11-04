// Workable: apply.workable.com/<account>/j/<code>/apply. The live site rate-limited the build
// sandbox, so this adapter is tested on a fixture hand-built from Workable's markup (data-ui hooks).
import type { SiteAdapter } from './types';
import { buttonByText, clip, meta, textOf } from './common';

export const workable: SiteAdapter = {
  id: 'workable',
  name: 'Workable',
  verification: 'fixture-tested',
  matches: (url) => url.hostname === 'apply.workable.com' || url.hostname.endsWith('.workable.com'),
  formRoot: (doc) => doc.querySelector<HTMLElement>('form[data-ui="application-form"]') ?? doc.querySelector<HTMLElement>('main form'),
  jobInfo(doc) {
    const role = textOf(doc.querySelector('[data-ui="job-title"], h1'));
    const company = meta(doc, 'og:site_name') || doc.title.split(' - ').pop()?.trim() || '';
    const description = textOf(doc.querySelector('[data-ui="job-description"], [data-ui="job-requirements"]'));
    return { company, role, description: clip(description) };
  },
  submitButton: (root) => root.querySelector<HTMLElement>('[data-ui="apply-button"], button[type="submit"]') ?? buttonByText(root, /^submit/i),
  nextButton: () => null,
};
