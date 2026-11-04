// Content script. Injected on demand by the service worker, only when the user asks to fill a page.
// It sees the DOM; it never sees storage. The worker sends it decided values to write.

import type { FieldDecision } from '../core/fields';
import type { ApplyResult, ResumeFile, ScanResult, TabRequest } from '../core/messages';
import { pickAdapter } from './adapters';
import type { SiteAdapter } from './adapters/types';
import { detectFields, findBlockers, type DetectedField } from './detect';
import { fillField } from './fill';
import { clearHighlights, highlight } from './highlight';

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
  const detected = root ? detectFields(root) : [];
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
  };
}

function apply(decisions: FieldDecision[], resume: ResumeFile | null): ApplyResult {
  const out = decisions.map((d) => {
    const field = fields.get(d.fieldId);
    if (!field) return { ...d, action: 'ask' as const, reason: 'Field disappeared from the page' };
    if (d.action === 'fill' && d.value !== null) {
      if (fillField(field, d.value, resume)) {
        highlight(field.elements[0], 'filled', d.confidence);
        return d;
      }
      highlight(field.elements[0], 'ask', d.confidence);
      return { ...d, action: 'ask' as const, reason: 'Stored answer does not match any option on this form' };
    }
    if (d.action === 'ask') highlight(field.elements[0], 'ask', d.confidence);
    return d;
  });
  return { decisions: out };
}

function setField(fieldId: string, value: string, resume: ResumeFile | null): boolean {
  const field = fields.get(fieldId);
  if (!field) return false;
  const ok = fillField(field, value, resume);
  if (ok) highlight(field.elements[0], 'filled', 1);
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

function next(): boolean {
  const btn = root && adapter ? adapter.nextButton(root) : null;
  btn?.click();
  return !!btn;
}

if (!window.__applyflowLoaded) {
  window.__applyflowLoaded = true;
  chrome.runtime.onMessage.addListener((msg: TabRequest, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id) return false;
    try {
      switch (msg.type) {
        case 'ping':
          sendResponse({ ok: true, result: 'pong' });
          break;
        case 'scan':
          sendResponse({ ok: true, result: scan() });
          break;
        case 'apply':
          sendResponse({ ok: true, result: apply(msg.decisions, msg.resume) });
          break;
        case 'setField':
          sendResponse({ ok: true, result: setField(msg.fieldId, msg.value, msg.resume) });
          break;
        case 'submit':
          sendResponse({ ok: true, result: submit(msg.dryRun) });
          break;
        case 'next':
          sendResponse({ ok: true, result: next() });
          break;
        default:
          return false;
      }
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return false;
  });
}
