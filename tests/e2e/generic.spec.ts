import { expect, serveFixture, swSend, tabIdFor, test } from './harness';
import { seed } from './seed';

const URL = 'https://applyflow.test/careers/backend-engineer';

interface Report {
  scan: { site: string; job: { company: string; role: string } };
  decisions: { fieldId: string; action: string; value: string | null; questionId: string | null }[];
}

test('generic adapter fills confident fields and leaves unknown ones for the user', async ({ context, sw }) => {
  await seed(sw);
  await serveFixture(context, URL, 'generic-careers.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);

  const report = await swSend<Report>(sw, { type: 'fillTab', tabId });
  expect(report.scan.site).toBe('generic');
  expect(report.scan.job.role).toBe('Backend Engineer');

  await expect(page.locator('#fn')).toHaveValue('Ada');
  await expect(page.locator('#ln')).toHaveValue('Lovelace');
  await expect(page.locator('#em')).toHaveValue('ada.lovelace@example.com');
  await expect(page.locator('input[name="notice"]')).toHaveValue('30');
  await expect(page.locator('#ctry')).toHaveValue('UK');
  await expect(page.locator('input[name="relocate"][value="yes"]')).toBeChecked();
  expect(await page.locator('#cv').evaluate((el: HTMLInputElement) => el.files?.[0]?.name)).toBe('ada-lovelace-cv.pdf');

  // Unknown question: not filled, sent to the user.
  await expect(page.locator('#tz')).toHaveValue('');
  const tz = report.decisions.find((d) => d.action === 'ask');
  expect(tz).toBeTruthy();
  await expect(page.locator('#tz')).toHaveAttribute('data-applyflow', /^ask/);

  // The search box outside the application form is never touched.
  await expect(page.locator('input[name="q"]')).toHaveValue('');
});

test('answering in the panel fills the page and is remembered for next time', async ({ context, sw }) => {
  await seed(sw);
  await serveFixture(context, URL, 'generic-careers.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);
  const report = await swSend<Report & { scan: { fields: { id: string; label: string }[] } }>(sw, { type: 'fillTab', tabId });
  const tzField = report.scan.fields.find((f) => f.label.includes('timezone'))!;
  await swSend(sw, { type: 'answerField', tabId, field: tzField, questionId: null, value: 'IST (UTC+5:30)', remember: true });
  await expect(page.locator('#tz')).toHaveValue('IST (UTC+5:30)');

  await page.reload();
  const again = await swSend<Report>(sw, { type: 'fillTab', tabId });
  await expect(page.locator('#tz')).toHaveValue('IST (UTC+5:30)');
  expect(again.decisions.filter((d) => d.action === 'ask')).toHaveLength(0);
});
