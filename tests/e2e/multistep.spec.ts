import { expect, serveFixture, swSend, tabIdFor, test } from './harness';
import { seed } from './seed';

interface Report {
  scan: { site: string; hasNext: boolean; hasSubmit: boolean; fields: { id: string; label: string }[] };
  decisions: { fieldId: string; action: string; value: string | null }[];
}

test('LinkedIn Easy Apply (synthetic): fills each step, never submits on its own', async ({ context, sw }) => {
  const url = 'https://www.linkedin.com/jobs/view/4012345678/';
  await seed(sw);
  await serveFixture(context, url, 'linkedin-easy-apply-synthetic.html');
  const page = await context.newPage();
  await page.goto(url);
  const tabId = await tabIdFor(sw, url);

  const step1 = await swSend<Report>(sw, { type: 'fillTab', tabId });
  expect(step1.scan.site).toBe('linkedin');
  await expect(page.locator('#single-line-text-form-component-first')).toHaveValue('Ada');
  await expect(page.locator('#single-line-text-form-component-phone')).toHaveValue('+44 20 7946 0000');
  // The account email LinkedIn prefilled is left alone.
  await expect(page.locator('#text-entity-list-form-component-email')).toHaveValue('prefilled@example.com');
  expect(step1.scan.hasNext).toBe(true);

  const step2 = await swSend<Report>(sw, { type: 'nextStep', tabId });
  await expect(page.locator('#spons-no')).toBeChecked();
  // No saved answer for Kubernetes years: asked, not guessed.
  const k8s = step2.scan.fields.find((f) => f.label.includes('Kubernetes'))!;
  expect(step2.decisions.find((d) => d.fieldId === k8s.id)!.action).toBe('ask');
  await expect(page.locator('#single-line-text-form-component-years-k8s')).toHaveValue('');

  const step3 = await swSend<Report>(sw, { type: 'nextStep', tabId });
  expect(step3.scan.hasSubmit).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __submitted?: number }).__submitted ?? 0)).toBe(0);
});

test('Naukri chatbot (synthetic): answers one question per step from the answer bank', async ({ context, sw }) => {
  const url = 'https://www.naukri.com/job-listings-senior-node-js-developer-pinecrest-123';
  await seed(sw);
  await serveFixture(context, url, 'naukri-synthetic.html');
  const page = await context.newPage();
  await page.goto(url);
  const tabId = await tabIdFor(sw, url);

  const q1 = await swSend<Report>(sw, { type: 'fillTab', tabId });
  expect(q1.scan.site).toBe('naukri');
  await expect(page.locator('.textArea')).toHaveText('30 days');

  await swSend<Report>(sw, { type: 'nextStep', tabId });
  await expect(page.locator('.ssrc__radio-btn-container input[value="Yes"]')).toBeChecked();

  const q3 = await swSend<Report>(sw, { type: 'nextStep', tabId });
  // Current CTC is not in the answer bank: the user is asked.
  expect(q3.decisions[0].action).toBe('ask');
  expect(await page.evaluate(() => (window as unknown as { __answers: string[] }).__answers)).toEqual(['30 days', 'Yes']);
});
