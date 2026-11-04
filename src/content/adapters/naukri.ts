// Naukri. Requires a signed-in user, so it is built from the documented apply flow and tested on a
// synthetic fixture only: UNVERIFIED until a signed-in user confirms it on the live site.
// After "Apply", recruiter questions arrive one at a time in a chatbot drawer: either a
// contenteditable text box or radio chips, followed by a Save button.
import type { DetectedField } from '../detect';
import type { SiteAdapter } from './types';
import { clip, textOf } from './common';
import { isVisible } from '../detect';

export const naukri: SiteAdapter = {
  id: 'naukri',
  name: 'Naukri',
  verification: 'unverified',
  matches: (url) => url.hostname === 'www.naukri.com' || url.hostname === 'naukri.com',
  formRoot: (doc) => Array.from(doc.querySelectorAll<HTMLElement>('.chatbot_DrawerContentWrapper')).find(isVisible) ?? null,
  skipSelector: '.chatbot_InputContainer',
  customFields(root) {
    const bot = root.querySelectorAll('.botItem .botMsg');
    const question = textOf(bot[bot.length - 1]);
    const radios = Array.from(root.querySelectorAll<HTMLInputElement>('.ssrc__radio-btn-container input[type="radio"]')).filter((r) => isVisible(r.closest('div') ?? r));
    const box = Array.from(root.querySelectorAll<HTMLElement>('.textArea[contenteditable="true"]')).find(isVisible);
    const descriptor = { id: '', label: question, required: true, name: 'naukri-chatbot', hasValue: false };
    if (radios.length) {
      const options = radios.map((r) => textOf(root.querySelector(`label[for="${r.id}"]`)) || r.value);
      return [{ descriptor: { ...descriptor, kind: 'radio', options }, elements: radios } satisfies DetectedField];
    }
    if (box) return [{ descriptor: { ...descriptor, kind: 'text', options: [], hasValue: !!box.textContent?.trim() }, elements: [box] } satisfies DetectedField];
    return [];
  },
  jobInfo(doc) {
    return {
      role: textOf(doc.querySelector('[class*="jd-header-title"]')),
      company: textOf(doc.querySelector('[class*="jd-header-comp-name"] a, [class*="jd-header-comp-name"]')),
      description: clip(textOf(doc.querySelector('[class*="dang-inner-html"], [class*="job-desc"]'))),
    };
  },
  // "Save" sends the answer and moves on; on the last question it completes the application.
  nextButton: (root) => root.querySelector<HTMLElement>('.sendMsg'),
  submitButton: () => null,
  nextMaySubmit: true,
};
