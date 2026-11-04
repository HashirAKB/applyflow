// LinkedIn Easy Apply. Requires a signed-in user, so it is built from documented DOM patterns and
// tested on a synthetic fixture only: UNVERIFIED until a signed-in user confirms it on the live site.
// LinkedIn's User Agreement prohibits automated activity; see the auto-submit risk screen.
import type { SiteAdapter } from './types';
import { clip, textOf } from './common';
import { isVisible } from '../detect';

const visibleButton = (root: ParentNode, selector: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(selector)).find(isVisible) ?? null;

export const linkedin: SiteAdapter = {
  id: 'linkedin',
  name: 'LinkedIn Easy Apply',
  verification: 'unverified',
  matches: (url) => url.hostname === 'www.linkedin.com' || url.hostname === 'linkedin.com',
  // Only the Easy Apply dialog. Without it open there is nothing to fill.
  formRoot: (doc) => doc.querySelector<HTMLElement>('.jobs-easy-apply-modal form, .jobs-easy-apply-content, [data-test-modal][aria-labelledby="jobs-apply-header"]'),
  // Question text lives in aria-hidden spans next to visually hidden duplicates.
  label(el) {
    const host = el.closest('fieldset, .fb-dash-form-element, [data-test-form-element]');
    const t = textOf(host?.querySelector('legend .fb-dash-form-element__label, .fb-dash-form-element__label, label.artdeco-text-input--label, legend'));
    return t ? t.replace(/\*\s*$/, '').trim() : null;
  },
  jobInfo(doc) {
    return {
      role: textOf(doc.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title')),
      company: textOf(doc.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')),
      description: clip(textOf(doc.querySelector('#job-details, .jobs-description__content'))),
    };
  },
  nextButton: (root) => visibleButton(root, 'button[aria-label="Continue to next step"], button[aria-label="Review your application"]'),
  submitButton: (root) => visibleButton(root, 'button[aria-label="Submit application"]'),
};
