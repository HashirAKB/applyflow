// Lever: jobs.lever.co/<company>/<id>/apply. Verified against captured public postings.
import type { SiteAdapter } from './types';
import { buttonByText, clip, meta, textOf } from './common';

export const lever: SiteAdapter = {
  id: 'lever',
  name: 'Lever',
  verification: 'live-tested',
  matches: (url) => url.hostname === 'jobs.lever.co',
  formRoot: (doc) => doc.querySelector<HTMLElement>('form#application-form, form.application-form'),
  // Lever wraps each control in a <label> that also contains upload status text; the question
  // itself is in .application-label (or .text for card questions).
  label(el) {
    const q = el.closest('.application-question, li');
    const t = textOf(q?.querySelector('.application-label, .text'));
    return t ? t.replace(/[✱*]\s*$/, '').trim() : null;
  },
  jobInfo(doc) {
    const role = textOf(doc.querySelector('.posting-headline h2, .posting-header h2'));
    // <title>: "Company - Role"
    const company = doc.title.split(' - ')[0]?.trim() ?? '';
    // The /apply page carries only a summary of the posting; fall back to it.
    const description = textOf(doc.querySelector('.posting-page .content, .section-wrapper.page-full-width')) || meta(doc, 'og:description');
    return { company, role, description: clip(description) };
  },
  submitButton: (root) => root.querySelector<HTMLElement>('#btn-submit, button[type="submit"]') ?? buttonByText(root, /^submit/i),
  nextButton: () => null,
};
