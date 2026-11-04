import type { Worker } from '@playwright/test';
import { expect, openPanel, serveFixture, swSend, tabIdFor, test } from './harness';
import { ANSWERS, seed } from './seed';

const URL = 'https://www.linkedin.com/jobs/view/4012345678/';
const submitted = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __submitted?: number }).__submitted ?? 0);

interface Auto {
  outcome: string;
  reasons: string[];
  steps: number;
}

async function setup(context: import('@playwright/test').BrowserContext, sw: Worker) {
  await seed(sw);
  // The user has answered every LinkedIn question before, so the form is fully fillable.
  await swSend(sw, { type: 'save', key: 'answers', value: [...ANSWERS, { questionId: 'years_skill:kubernetes', value: '4', aliases: [], updatedAt: '' }, { questionId: 'work_mode', value: 'Yes', aliases: [], updatedAt: '' }] });
  await serveFixture(context, URL, 'linkedin-easy-apply-synthetic.html');
  const page = await context.newPage();
  await page.goto(URL);
  return { page, tabId: await tabIdFor(sw, URL) };
}

async function enable(sw: Worker, patch: Record<string, unknown>) {
  const state = await swSend<{ settings: { autoSubmit: Record<string, unknown> } }>(sw, { type: 'getState' });
  await swSend(sw, {
    type: 'save',
    key: 'settings',
    value: { ...state.settings, autoSubmit: { ...state.settings.autoSubmit, enabled: true, riskAcknowledged: true, sites: { linkedin: true }, minDelayMs: 500, maxDelayMs: 600, ...patch } },
  });
}

test('auto-submit is off by default and never clicks submit', async ({ context, sw }) => {
  const { page, tabId } = await setup(context, sw);
  const res = await swSend<Auto>(sw, { type: 'autoApply', tabId });
  expect(res.outcome).toBe('stopped');
  expect(res.reasons).toContain('Auto-submit is off.');
  expect(res.reasons).toContain('The risk confirmation has not been accepted.');
  expect(await submitted(page)).toBe(0);
});

test('turning it on requires the risk confirmation screen', async ({ context, extensionId }) => {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await panel.getByRole('tab', { name: 'Settings' }).click();
  await panel.getByRole('button', { name: 'Turn on auto-submit...' }).click();
  const card = panel.getByTestId('risk-confirmation');
  await expect(card).toContainText("LinkedIn's User Agreement");
  await expect(card.getByRole('button', { name: 'Turn on auto-submit' })).toBeDisabled();
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: 'Turn on auto-submit' }).click();
  await expect(panel.getByRole('button', { name: 'Stop all auto-submit' })).toBeVisible();
  // Dry run stays on by default.
  await expect(panel.getByLabel('Dry run (never click the final submit)')).toBeChecked();
});

test('dry run walks every step but never submits', async ({ context, sw }) => {
  const { page, tabId } = await setup(context, sw);
  await enable(sw, { dryRun: true });
  const res = await swSend<Auto>(sw, { type: 'autoApply', tabId });
  expect(res.outcome).toBe('dry-run');
  expect(res.steps).toBe(3);
  expect(await submitted(page)).toBe(0);
  await expect(page.locator('[aria-label="Submit application"]')).toHaveAttribute('data-applyflow', /filled/);
});

test('submits when every gate passes, then the daily cap stops the next one', async ({ context, sw }) => {
  const { page, tabId } = await setup(context, sw);
  await enable(sw, { dryRun: false, dailyCap: 1 });
  const res = await swSend<Auto>(sw, { type: 'autoApply', tabId });
  expect(res.outcome).toBe('submitted');
  expect(await submitted(page)).toBe(1);
  const apps = (await sw.evaluate(async () => (await chrome.storage.local.get('applications')).applications)) as { status: string }[];
  expect(apps[0].status).toBe('submitted');

  await page.reload();
  const again = await swSend<Auto>(sw, { type: 'autoApply', tabId });
  expect(again.outcome).toBe('stopped');
  expect(again.reasons).toContain('Daily limit reached (1 on linkedin).');
  expect(await submitted(page)).toBe(0);
});

test('a required question without a saved answer stops the run on that step', async ({ context, sw }) => {
  const { page, tabId } = await setup(context, sw);
  await swSend(sw, { type: 'save', key: 'answers', value: ANSWERS });
  await enable(sw, { dryRun: false });
  const res = await swSend<Auto>(sw, { type: 'autoApply', tabId });
  expect(res.outcome).toBe('stopped');
  expect(res.steps).toBe(2);
  expect(res.reasons.join(' ')).toContain('Kubernetes');
  expect(await submitted(page)).toBe(0);
});

test('the side panel shows the auto-apply result', async ({ context, sw, extensionId }) => {
  const { tabId } = await setup(context, sw);
  await enable(sw, { dryRun: true });
  const panel = await openPanel(context, extensionId, tabId);
  await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
  await panel.getByRole('button', { name: 'Auto-apply (dry run)' }).click();
  await expect(panel.getByTestId('auto-result')).toContainText('Dry run complete.');
});
