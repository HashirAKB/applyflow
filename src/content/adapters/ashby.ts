// Ashby: jobs.ashbyhq.com/<company>/<id>/application. Verified against captured public postings.
// There is no <form> element; yes/no questions are button pairs backed by a hidden checkbox.
import type { DetectedField } from '../detect';
import type { SiteAdapter } from './types';
import { buttonByText, clip, meta, textOf } from './common';

const ENTRY = '.ashby-application-form-field-entry';

export const ashby: SiteAdapter = {
  id: 'ashby',
  name: 'Ashby',
  verification: 'live-tested',
  matches: (url) => url.hostname === 'jobs.ashbyhq.com',
  formRoot: (doc) =>
    doc.querySelector<HTMLElement>('.ashby-application-form-container') ??
    doc.querySelector<HTMLElement>('#form[role="tabpanel"]') ??
    (doc.querySelector(ENTRY)?.parentElement as HTMLElement | null),
  // The resume "autofill" dropzone makes Ashby parse the file and overwrite fields: never touch it.
  // The yes/no hidden checkboxes are handled as button pairs by customFields.
  skipSelector: '.ashby-application-form-autofill-input-root, .ashby-application-form-autofill-pane, .ashby-application-form-input-yesno',
  label(el) {
    // Radios inside an entry are sub-questions (SMS / WhatsApp consent under Phone): use their own group label.
    if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) return null;
    return textOf(el.closest(ENTRY)?.querySelector('.ashby-application-form-question-title')) || null;
  },
  customFields(root) {
    return Array.from(root.querySelectorAll<HTMLElement>('.ashby-application-form-input-yesno')).map((box): DetectedField => {
      const buttons = Array.from(box.querySelectorAll<HTMLElement>('button'));
      const title = box.closest(ENTRY)?.querySelector('.ashby-application-form-question-title');
      return {
        descriptor: {
          id: '',
          label: textOf(title).replace(/\*\s*$/, ''),
          kind: 'radio',
          options: buttons.map(textOf),
          required: !!title && /_required_/.test(title.className),
          name: box.querySelector('input')?.getAttribute('name') ?? '',
          hasValue: buttons.some((b) => b.getAttribute('aria-pressed') === 'true'),
        },
        elements: buttons,
      };
    });
  },
  jobInfo(doc) {
    const role = textOf(doc.querySelector('.ashby-job-posting-heading, h1'));
    const company = meta(doc, 'og:site_name') || doc.title.split(/[@|]/).pop()?.trim() || '';
    const description = textOf(doc.querySelector('.ashby-job-posting-description, [class*="descriptionText"]')) || meta(doc, 'description');
    return { company, role, description: clip(description) };
  },
  // The submit button sits outside the tab panel that holds the fields.
  submitButton: (root) =>
    root.ownerDocument.querySelector<HTMLElement>('.ashby-application-form-submit-button') ?? buttonByText(root.ownerDocument, /^submit application/i),
  nextButton: () => null,
};
