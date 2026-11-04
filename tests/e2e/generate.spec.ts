import { expect, openPanel, serveFixture, swSend, tabIdFor, test } from './harness';
import { seed } from './seed';

const URL = 'https://apply.workable.com/brightline/j/ABC123/apply/';

test('drafts a grounded cover letter from the profile and the job description, then fills it', async ({ context, sw, extensionId }) => {
  await seed(sw);
  const state = await swSend<{ settings: Record<string, unknown> }>(sw, { type: 'getState' });
  await swSend(sw, { type: 'save', key: 'settings', value: { ...state.settings, llm: { provider: 'mock', baseUrl: '', model: '' } } });
  await serveFixture(context, URL, 'workable-synthetic.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);

  const panel = await openPanel(context, extensionId, tabId);
  await panel.setViewportSize({ width: 400, height: 900 });
  await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
  const card = panel.getByTestId('ask-field').filter({ hasText: 'Cover letter' });
  await card.getByRole('button', { name: 'Draft from my profile' }).click();
  const box = card.getByRole('textbox');
  await expect(box).toHaveValue(/Frontend Engineer position at Brightline Health/);
  const draft = await box.inputValue();
  // Every claim comes from the seeded profile.
  expect(draft).toContain('Analytical Engines Ltd');
  await card.screenshot({ path: 'docs/screenshots/sidepanel-draft.png' });
  await card.getByRole('button', { name: 'Fill' }).click();
  await expect(page.locator('#cover_letter')).toHaveValue(draft);
});

test('refuses to draft when the profile is empty', async ({ context, sw }) => {
  await serveFixture(context, URL, 'workable-synthetic.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);
  const report = await swSend<{ scan: { fields: { label: string }[] } }>(sw, { type: 'fillTab', tabId });
  const field = report.scan.fields.find((f) => f.label === 'Cover letter');
  const res = await swSend<{ text: string; problems: string[] }>(sw, { type: 'generate', tabId, field });
  expect(res.text).toBe('');
  expect(res.problems[0]).toMatch(/write this answer yourself/);
});
