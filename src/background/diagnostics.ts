// "Report a broken site": a redacted snapshot of the form and how applyflow mapped each field.
// Nothing is sent anywhere; the side panel saves it as a file the user can inspect and attach to an issue.
import { matchField } from '../core/matching';
import type { ScanResult } from '../core/messages';
import { scrubText, secretsFrom } from '../core/redact';
import type { Store } from '../storage/store';
import { ensureContentScript, tabSend } from './tabs';

export async function diagnostics(store: Store, tabId: number) {
  await ensureContentScript(tabId);
  const scan = await tabSend<ScanResult>(tabId, { type: 'scan' });
  const [settings, profile, answers, secrets] = await Promise.all([store.get('settings'), store.get('profile'), store.get('answers'), store.get('secrets')]);
  const scrub = secretsFrom({ profile, answers: answers.map((a) => a.value), key: secrets.llmApiKey });
  const html = await tabSend<string>(tabId, { type: 'diagnose', secrets: scrub });
  const fields = [];
  for (const f of scan.fields) {
    // Rules and fuzzy only: a bug report should not depend on, or call, the user's LLM.
    const m = await matchField(f, { answers: [], threshold: settings.threshold });
    fields.push({
      label: scrubText(f.label, scrub),
      kind: f.kind,
      required: f.required,
      name: scrubText(f.name, scrub),
      options: f.options.map((o) => scrubText(o, scrub)),
      matchedQuestion: m.questionId,
      confidence: Number(m.confidence.toFixed(2)),
      method: m.method,
    });
  }
  const u = new URL(scan.url);
  return {
    report: 'applyflow broken-site report',
    version: chrome.runtime.getManifest().version,
    createdAt: new Date().toISOString(),
    url: `${u.origin}${u.pathname}`,
    site: scan.site,
    adapterVerification: scan.verification,
    blockers: scan.blockers,
    hasNext: scan.hasNext,
    hasSubmit: scan.hasSubmit,
    fields,
    html,
  };
}
