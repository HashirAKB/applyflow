import { expect, openPanel, serveFixture, tabIdFor, test } from './harness';
import { seed } from './seed';

const URL = 'https://applyflow.test/careers/backend-engineer';

test('onboarding: import a PDF resume, review and save the profile', async ({ context, extensionId }) => {
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 400, height: 900 });
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(panel.getByText('Welcome')).toBeVisible();
  await panel.getByRole('button', { name: 'Set up my profile' }).click();
  await panel.getByLabel('Resume file').setInputFiles('tests/fixtures/resume/sample-resume.pdf');
  await expect(panel.getByText('Imported. Review every field')).toBeVisible();
  await expect(panel.getByLabel('First name')).toHaveValue('Priya');
  await expect(panel.getByLabel('Email')).toHaveValue('priya.raman@example.com');
  await expect(panel.locator('input').filter({ hasText: '' }).nth(0)).toBeVisible();
  await panel.screenshot({ path: 'docs/screenshots/sidepanel-profile.png', fullPage: false });
  await panel.getByRole('button', { name: 'Save profile' }).click();
  await expect(panel.getByText('Saved.')).toBeVisible();
  await expect(panel.getByText('Saved resume: sample-resume.pdf')).toBeVisible();
});

test('fill tab: scan, see what was filled and answer what needs you', async ({ context, sw, extensionId }) => {
  await seed(sw);
  await serveFixture(context, URL, 'generic-careers.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);

  const panel = await openPanel(context, extensionId, tabId);
  await panel.setViewportSize({ width: 400, height: 900 });
  await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
  await expect(panel.getByText('Backend Engineer')).toBeVisible();
  await expect(panel.getByRole('heading', { name: /Filled/ })).toBeVisible();
  const ask = panel.getByTestId('ask-field').filter({ hasText: 'timezone' });
  await expect(ask).toBeVisible();
  await panel.screenshot({ path: 'docs/screenshots/sidepanel-fill.png' });

  await ask.getByRole('textbox').fill('IST (UTC+5:30)');
  await ask.getByRole('button', { name: 'Fill' }).click();
  await expect(page.locator('#tz')).toHaveValue('IST (UTC+5:30)');
  await expect(panel.getByTestId('ask-field').filter({ hasText: 'timezone' })).toHaveCount(0);
});

test('tracker logs the application with answers and the job description, and exports CSV', async ({ context, sw, extensionId }) => {
  await seed(sw);
  await serveFixture(context, URL, 'generic-careers.html');
  const page = await context.newPage();
  await page.goto(URL);
  const tabId = await tabIdFor(sw, URL);
  const panel = await openPanel(context, extensionId, tabId);
  await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
  await expect(panel.getByText('Backend Engineer')).toBeVisible();

  const apps = (await sw.evaluate(async () => (await chrome.storage.local.get('applications')).applications)) as { company: string; answers: Record<string, string>; jobDescription: string }[];
  expect(apps).toHaveLength(1);
  expect(apps[0]).toMatchObject({ company: 'Northwind Labs', role: 'Backend Engineer', site: 'generic', status: 'filled' });
  expect(apps[0].answers['First name']).toBe('Ada');
  expect(apps[0].jobDescription).toContain('logistics software');

  await panel.getByRole('tab', { name: 'Tracker' }).click();
  await expect(panel.getByTestId('application-row')).toHaveCount(1);
  await panel.getByLabel('Status for Backend Engineer').selectOption('interviewing');
  const download = panel.waitForEvent('download');
  await panel.getByRole('button', { name: 'Export CSV' }).click();
  const csv = await (await download).createReadStream().then(async (s) => {
    let t = '';
    for await (const c of s) t += c;
    return t;
  });
  expect(csv).toContain('Northwind Labs,Backend Engineer,interviewing');
});
