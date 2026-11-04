import { expect, test } from './harness';

test('extension loads and the side panel renders', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  await expect(page.getByRole('heading', { name: 'applyflow' })).toBeVisible();
});
