// The fill flow: scan the page, match every field, decide, write confident values, report the rest.
import { rememberAnswer } from '../core/answers';
import type { FieldDecision, FieldDescriptor } from '../core/fields';
import { decide, matchField } from '../core/matching';
import { recordApplication } from '../core/tracker';
import { draftAnswer, type Draft } from '../core/guard';
import type { ApplyResult, ScanResult } from '../core/messages';
import type { Store } from '../storage/store';
import { providerFor } from './llm';
import { ensureContentScript, tabSend } from './tabs';

export interface FillReport {
  scan: ScanResult;
  decisions: FieldDecision[];
}

export async function fillTab(store: Store, tabId: number): Promise<FillReport> {
  await ensureContentScript(tabId);
  const scan = await tabSend<ScanResult>(tabId, { type: 'scan' });
  const [settings, secrets, profile, answers, resume] = await Promise.all([
    store.get('settings'),
    store.get('secrets'),
    store.get('profile'),
    store.get('answers'),
    store.get('resume'),
  ]);
  const llm = providerFor(settings, secrets);
  const data = { profile, answers, hasResume: !!resume, threshold: settings.threshold };

  const decisions: FieldDecision[] = [];
  for (const field of scan.fields) {
    const match = await matchField(field, { answers, threshold: settings.threshold, llm });
    decisions.push(decide(field, match, data));
  }
  const applied = await tabSend<ApplyResult>(tabId, { type: 'apply', decisions, resume });

  // Log the application with the answers actually written to the page.
  const labels = new Map(scan.fields.map((f) => [f.id, f.label]));
  const used: Record<string, string> = {};
  for (const d of applied.decisions) {
    if (d.action === 'fill' && d.value !== null) used[labels.get(d.fieldId) ?? d.fieldId] = d.value === 'resume' ? (resume?.name ?? 'resume') : d.value;
  }
  if (scan.fields.length) {
    await store.update('applications', (list) =>
      recordApplication(list, { url: scan.url, site: scan.site, company: scan.job.company, role: scan.job.role, jobDescription: scan.job.description, answers: used }),
    );
  }
  return { scan, decisions: applied.decisions };
}

/** Draft a written answer grounded in the profile and the job description on the page. */
export async function generate(store: Store, tabId: number, field: FieldDescriptor): Promise<Draft> {
  await ensureContentScript(tabId);
  const scan = await tabSend<ScanResult>(tabId, { type: 'scan' });
  const [settings, secrets, profile] = await Promise.all([store.get('settings'), store.get('secrets'), store.get('profile')]);
  return draftAnswer(field.label, profile, scan.job, providerFor(settings, secrets));
}

/** User asked to move to the next step: click the site's own Next button, let it render, fill again. */
export async function nextStep(store: Store, tabId: number): Promise<FillReport> {
  await ensureContentScript(tabId);
  await tabSend<ScanResult>(tabId, { type: 'scan' });
  if (!(await tabSend<boolean>(tabId, { type: 'next' }))) throw new Error('No next button found on this step.');
  await new Promise((r) => setTimeout(r, 800));
  return fillTab(store, tabId);
}

/** The user answered a field in the side panel: write it to the page and (optionally) remember it. */
export async function answerField(
  store: Store,
  tabId: number,
  field: FieldDescriptor,
  questionId: string | null,
  value: string,
  remember: boolean,
): Promise<boolean> {
  if (remember && field.kind !== 'file') {
    await store.update('answers', (bank) => rememberAnswer(bank, { questionId, label: field.label, value }));
  }
  await ensureContentScript(tabId);
  const ok = await tabSend<boolean>(tabId, { type: 'setField', fieldId: field.id, value, resume: field.kind === 'file' ? await store.get('resume') : null });
  const url = (await chrome.tabs.get(tabId)).url;
  if (ok && url) {
    await store.update('applications', (list) =>
      recordApplication(list, { url, site: '', company: '', role: '', jobDescription: '', answers: { [field.label]: value } }),
    );
  }
  return ok;
}
