// The fill flow: scan the page, match every field, decide, write confident values, report the rest.
import { rememberAnswer } from '../core/answers';
import type { FieldDecision, FieldDescriptor } from '../core/fields';
import { decide, matchField } from '../core/matching';
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
  return { scan, decisions: applied.decisions };
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
  return tabSend<boolean>(tabId, { type: 'setField', fieldId: field.id, value, resume: field.kind === 'file' ? await store.get('resume') : null });
}
