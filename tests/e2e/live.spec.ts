// Live smoke test against real public postings. Skipped automatically when the network is not
// reachable. Dry run only: applyflow is never asked to submit, and as a second guard any
// non-GET request that looks like a submission or a file upload is aborted. (Ashby loads its form
// through GraphQL POST queries, so blocking every POST would break the page.)
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, openPanel, swSend, tabIdFor, test } from './harness';
import { seed } from './seed';

async function json(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Current postings, discovered through each platform's public job-board API. */
async function postings(): Promise<{ platform: string; url: string }[]> {
  const out: { platform: string; url: string }[] = [];
  const gh = (await json('https://boards-api.greenhouse.io/v1/boards/gitlab/jobs')) as { jobs: { absolute_url: string }[] };
  out.push({ platform: 'greenhouse', url: gh.jobs[0].absolute_url });
  const lever = (await json('https://api.lever.co/v0/postings/spotify?mode=json&limit=1')) as { applyUrl: string }[];
  out.push({ platform: 'lever', url: lever[0].applyUrl });
  const ashby = (await json('https://api.ashbyhq.com/posting-api/job-board/ramp')) as { jobs: { jobUrl: string }[] };
  out.push({ platform: 'ashby', url: `${ashby.jobs[0].jobUrl}/application` });
  return out;
}

let online = true;
let targets: { platform: string; url: string }[] = [];
test.beforeAll(async () => {
  try {
    targets = await postings();
  } catch {
    online = false;
  }
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/live-report.md', `Live dry run, ${new Date().toISOString().slice(0, 10)}\n\n| Platform | URL | Fields | Filled | Sent to user | Fill rate |\n| --- | --- | --- | --- | --- | --- |\n`);
});

for (const platform of ['greenhouse', 'lever', 'ashby']) {
  test(`live dry run: ${platform}`, async ({ context, sw, extensionId }) => {
    test.skip(!online || process.env.APPLYFLOW_SKIP_LIVE === '1', 'No network: live smoke test skipped');
    const target = targets.find((t) => t.platform === platform)!;
    await seed(sw);
    await context.route('**/*', (route) => {
      const req = route.request();
      if (req.method() === 'GET') return route.continue();
      const isFileUpload = (req.headers()['content-type'] ?? '').startsWith('multipart/form-data');
      const looksLikeSubmitOrUpload = /submit|upload|parse|resume/i.test(req.url()) || /submit/i.test(req.postData() ?? '');
      // Abort submissions, and keep our dummy resume off real companies' resume parsers.
      return isFileUpload || looksLikeSubmitOrUpload ? route.abort() : route.continue();
    });
    const page = await context.newPage();
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForSelector('input, textarea, select', { timeout: 30_000 });
    const tabId = await tabIdFor(sw, page.url().split('?')[0]);
    const report = await swSend<{ scan: { site: string; fields: unknown[] }; decisions: { action: string }[] }>(sw, { type: 'fillTab', tabId });
    expect(report.scan.site).toBe(platform);
    expect(report.scan.fields.length).toBeGreaterThan(3);
    const filled = report.decisions.filter((d) => d.action === 'fill').length;
    const asked = report.decisions.filter((d) => d.action === 'ask').length;
    appendFileSync('test-results/live-report.md', `| ${platform} | ${target.url} | ${report.decisions.length} | ${filled} | ${asked} | ${Math.round((100 * filled) / report.decisions.length)}% |\n`);
    expect(filled).toBeGreaterThan(2);
    await page.locator('[data-applyflow]').first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.screenshot({ path: `docs/screenshots/live-${platform}.png` });
    if (platform === 'lever') {
      const panel = await openPanel(context, extensionId, tabId);
      await panel.setViewportSize({ width: 420, height: 900 });
      await panel.getByRole('button', { name: 'Scan and fill this page' }).click();
      await panel.getByRole('heading', { name: /Filled/ }).waitFor();
      await panel.screenshot({ path: 'docs/screenshots/live-lever-panel.png' });
    }
    if (platform === 'greenhouse') {
      // Custom dropdowns really hold the chosen options (read from react-select's own display).
      const chosen = await page.locator('.select__single-value').allTextContents();
      console.log('greenhouse dropdowns:', chosen);
      expect(chosen.some((t) => t.includes('United Kingdom'))).toBe(true);
    }
  });
}
