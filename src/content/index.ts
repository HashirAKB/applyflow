// Content script. Injected on demand by the service worker, only when the user asks to fill a page.
// It sees the DOM; it never sees storage. The worker sends it decided values to write.

import type { FieldDecision } from '../core/fields';
import type { ApplyResult, ResumeFile, ScanResult, TabRequest } from '../core/messages';
import { pickAdapter } from './adapters';
import type { SiteAdapter } from './adapters/types';
import { detectFields, findBlockers, type DetectedField } from './detect';
import { fillField } from './fill';
import { clearHighlights, highlight } from './highlight';
import { redactTree } from '../core/redact';

declare global {
  interface Window {
    __applyflowLoaded?: boolean;
  }
}

let adapter: SiteAdapter | null = null;
let root: HTMLElement | null = null;
let fields = new Map<string, DetectedField>();

function scan(): ScanResult {
  adapter = pickAdapter(new URL(location.href), document);
  root = adapter.formRoot(document);
  clearHighlights(document);
  const detected = root ? detectFields(root, adapter) : [];
  fields = new Map(detected.map((f) => [f.descriptor.id, f]));
  return {
    site: adapter.id,
    siteName: adapter.name,
    url: location.href,
    fields: detected.map((f) => f.descriptor),
    job: adapter.jobInfo(document),
    blockers: findBlockers(document),
    hasNext: !!(root && adapter.nextButton(root)),
    hasSubmit: !!(root && adapter.submitButton(root)),
    nextMaySubmit: !!adapter.nextMaySubmit,
    verification: adapter.verification,
  };
}

async function apply(decisions: FieldDecision[], resume: ResumeFile | null): Promise<ApplyResult> {
  const out: FieldDecision[] = [];
  // Sequential on purpose: custom dropdowns open one menu at a time.
  for (const d of decisions) {
    const field = fields.get(d.fieldId);
    if (!field) {
      out.push({ ...d, action: 'ask', reason: 'Field disappeared from the page' });
    } else if (d.action === 'fill' && d.value !== null) {
      if (await fillField(field, d.value, resume)) {
        highlight(field.elements[0], 'filled', d.confidence, d.fieldId);
        out.push(d);
      } else {
        highlight(field.elements[0], 'ask', d.confidence, d.fieldId);
        out.push({ ...d, action: 'ask', reason: 'Saved answer does not match any option on this form' });
      }
    } else {
      if (d.action === 'ask') highlight(field.elements[0], 'ask', d.confidence, d.fieldId);
      out.push(d);
    }
  }
  return { decisions: out };
}

async function setField(fieldId: string, value: string, resume: ResumeFile | null): Promise<boolean> {
  const field = fields.get(fieldId);
  if (!field) return false;
  const ok = await fillField(field, value, resume);
  if (ok) highlight(field.elements[0], 'filled', 1, fieldId);
  return ok;
}

function submit(dryRun: boolean): { clicked: boolean; found: boolean } {
  const btn = root && adapter ? adapter.submitButton(root) : null;
  if (!btn) return { clicked: false, found: false };
  if (dryRun) {
    highlight(btn, 'filled', 1);
    return { clicked: false, found: true };
  }
  btn.click();
  return { clicked: true, found: true };
}

/** Redacted copy of the form (or the page when no form was found) for a bug report. */
function diagnose(secrets: string[]): string {
  const source = root ?? document.body;
  const clone = source.cloneNode(true) as HTMLElement;
  redactTree(clone, secrets);
  return clone.outerHTML;
}

function next(): boolean {
  const btn = root && adapter ? adapter.nextButton(root) : null;
  btn?.click();
  return !!btn;
}

if (!window.__applyflowLoaded) {
  window.__applyflowLoaded = true;
  chrome.runtime.onMessage.addListener((msg: TabRequest, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    const run = (): unknown | Promise<unknown> => {
      switch (msg.type) {
        case 'ping':
          return 'pong';
        case 'scan':
          return scan();
        case 'apply':
          return apply(msg.decisions, msg.resume);
        case 'setField':
          return setField(msg.fieldId, msg.value, msg.resume);
        case 'submit':
          return submit(msg.dryRun);
        case 'next':
          return next();
        case 'diagnose':
          return diagnose(msg.secrets);
        default:
          throw new Error(`Unknown request ${(msg as { type: string }).type}`);
      }
    };
    Promise.resolve()
      .then(run)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true; // async response
  });
}
