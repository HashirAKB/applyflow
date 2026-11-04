import type { JobInfo } from '../../core/messages';
import type { DetectHooks } from '../detect';

// One interface for every site. An adapter only knows where things are on its site;
// matching and filling are shared.

export type Verification = 'live-tested' | 'fixture-tested' | 'unverified';

export interface SiteAdapter extends DetectHooks {
  id: string;
  name: string;
  verification: Verification;
  matches(url: URL, doc: Document): boolean;
  /** The application form (or the current step of it). */
  formRoot(doc: Document): HTMLElement | null;
  jobInfo(doc: Document): JobInfo;
  /** Final submit button, or null when not on the last step. */
  submitButton(root: HTMLElement): HTMLElement | null;
  /** "Next" / "Continue" button on multi-step flows. */
  nextButton(root: HTMLElement): HTMLElement | null;
  /** True when clicking "next" can complete the application (Naukri's chatbot Save). Auto-submit then gates it like submit. */
  nextMaySubmit?: boolean;
}
