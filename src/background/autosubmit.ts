// Auto-apply run, started only by the user clicking "Auto-apply" in the side panel.
// Each step: fill, check the gate, wait a human-scale pause, then click next or submit.
// It never handles logins or CAPTCHAs; any blocker stops the run and hands control back.
import { gate, localDay, pacingDelay, type GateResult } from '../core/autosubmit';
import { canonicalUrl, setStatus } from '../core/tracker';
import type { Store } from '../storage/store';
import { fillTab, type FillReport } from './fill';
import { tabSend } from './tabs';

const MAX_STEPS = 8;

export interface AutoResult {
  outcome: 'submitted' | 'dry-run' | 'stopped';
  reasons: string[];
  steps: number;
  report: FillReport;
}

export async function autoApply(store: Store, tabId: number, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<AutoResult> {
  for (let step = 1; ; step++) {
    const settings = await store.get('settings');
    const usage = await store.get('usage');
    const report = await fillTab(store, tabId);
    const { scan, decisions } = report;
    const today = usage[scan.site]?.date === localDay() ? usage[scan.site].count : 0;
    const result: GateResult =
      step > MAX_STEPS
        ? { allowed: false, reasons: ['Too many steps; stopping so you can check the form.'] }
        : gate({
            settings: settings.autoSubmit,
            threshold: settings.threshold,
            site: scan.site,
            usedToday: today,
            fields: scan.fields,
            decisions,
            blockers: scan.blockers,
            hasSubmit: scan.hasSubmit,
            hasNext: scan.hasNext,
            nextMaySubmit: scan.nextMaySubmit,
          });
    if (!result.allowed) return { outcome: 'stopped', reasons: result.reasons, steps: step, report };

    await sleep(pacingDelay(settings.autoSubmit));
    // Re-read the kill switch after the pause: the user may have hit stop while we waited.
    if (!(await store.get('settings')).autoSubmit.enabled) return { outcome: 'stopped', reasons: ['Stopped by the kill switch.'], steps: step, report };

    if (result.action === 'dry-run') {
      await tabSend(tabId, { type: 'submit', dryRun: true });
      return { outcome: 'dry-run', reasons: ['Dry run: everything is ready, the submit button is highlighted but was not clicked.'], steps: step, report };
    }
    if (result.action === 'next') {
      await tabSend(tabId, { type: 'next' });
      await sleep(800);
      continue;
    }
    // Count before clicking, so a crash after the click can never allow an extra submission.
    await store.update('usage', (u) => ({ ...u, [scan.site]: { date: localDay(), count: today + 1 } }));
    await tabSend(tabId, { type: 'submit', dryRun: false });
    const url = canonicalUrl(scan.url);
    await store.update('applications', (list) => {
      const rec = list.find((a) => a.url === url);
      return rec ? setStatus(list, rec.id, 'submitted') : list;
    });
    return { outcome: 'submitted', reasons: [], steps: step, report };
  }
}
