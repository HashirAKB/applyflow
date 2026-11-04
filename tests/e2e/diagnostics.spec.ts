import { expect, openPanel, serveFixture, tabIdFor, test } from './harness';
import { ANSWERS, PROFILE, seed } from './seed';

test('broken-site report contains structure and mapping but no personal values', async ({ context, sw, extensionId }) => {
  const url = 'https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b/apply?utm=x';
  await seed(sw);
  await serveFixture(context, url, 'lever-spotify.html');
  const page = await context.newPage();
  await page.goto(url);
  const tabId = await tabIdFor(sw, url);
  const panel = await openPanel(context, extensionId, tabId);
  // Fill first, so the page is full of personal values when the report is taken.
  await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
  await expect(page.locator('input[name="email"]')).toHaveValue(PROFILE.email);

  const download = panel.waitForEvent('download');
  await panel.getByRole('button', { name: 'Report a broken site' }).click();
  let text = '';
  for await (const chunk of await (await download).createReadStream()) text += chunk;
  const report = JSON.parse(text);

  expect(report.site).toBe('lever');
  expect(report.url).toBe('https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b/apply');
  expect(report.fields.find((f: { label: string }) => f.label === 'Email').matchedQuestion).toBe('email');
  expect(report.html).toContain('application-form');
  for (const secret of [PROFILE.email, PROFILE.firstName, PROFILE.lastName, PROFILE.phone, PROFILE.linkedin, 'Analytical Engines', ...ANSWERS.map((a) => a.value).filter((v) => v.length > 3)]) {
    expect(text, `report leaks ${secret}`).not.toContain(secret);
  }
});
