// Greenhouse: job-boards.greenhouse.io (current React boards) and boards.greenhouse.io (classic).
// Verified against captured public postings (tests/fixtures/greenhouse-*.html).
import type { SiteAdapter } from './types';
import { buttonByText, clip, textOf } from './common';

export const greenhouse: SiteAdapter = {
  id: 'greenhouse',
  name: 'Greenhouse',
  verification: 'fixture-tested',
  matches: (url) => /(^|\.)greenhouse\.io$/.test(url.hostname),
  formRoot: (doc) => doc.querySelector<HTMLElement>('form#application-form, form.application--form, form#application_form'),
  jobInfo(doc) {
    const role = textOf(doc.querySelector('.job__title h1, h1.section-header, #app_title, h1'));
    // og:title / title look like "Job Application for <role> at <company>".
    const company = doc.title.match(/ at (.+)$/)?.[1]?.trim() || textOf(doc.querySelector('.company-name')).replace(/^at\s+/i, '');
    const description = textOf(doc.querySelector('.job__description, #content'));
    return { company, role, description: clip(description) };
  },
  submitButton: (root) => root.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]') ?? buttonByText(root, /^submit/i),
  nextButton: () => null,
};
