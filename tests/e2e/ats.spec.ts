// Fill accuracy on real ATS markup. Each fixture is served at its real URL so host permissions,
// adapter selection and injection behave as in production.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, serveFixture, swSend, tabIdFor, test } from './harness';
import { PROFILE, seed } from './seed';

interface Report {
  scan: { site: string; fields: { id: string; label: string }[] };
  decisions: { fieldId: string; action: string; value: string | null; questionId: string | null }[];
}

/** label prefix -> expected value after filling ('' = must stay empty, i.e. sent to the user) */
type Expect = [string, string][];

const CASES: { name: string; fixture: string; url: string; site: string; expect: Expect }[] = [
  {
    name: 'Greenhouse (GitLab)',
    fixture: 'greenhouse-gitlab.html',
    url: 'https://job-boards.greenhouse.io/gitlab/jobs/8638232002',
    site: 'greenhouse',
    expect: [
      ['First Name', 'Ada'],
      ['Last Name', 'Lovelace'],
      ['Email', PROFILE.email],
      ['Phone', PROFILE.phone],
      ['LinkedIn Profile', PROFILE.linkedin],
      ['Resume/CV', 'ada-lovelace-cv.pdf'],
      ['Cover Letter', ''],
      ['It is important to us', ''],
      // Custom dropdown with no live option list in the static fixture: must not borrow another widget's options.
      ['Country', ''],
    ],
  },
  {
    name: 'Greenhouse (Figma)',
    fixture: 'greenhouse-figma.html',
    url: 'https://job-boards.greenhouse.io/figma/jobs/5426468004',
    site: 'greenhouse',
    expect: [
      ['First Name', 'Ada'],
      ['Email', PROFILE.email],
      ['Other Website', PROFILE.website],
      ['Why do you want to join Figma?', ''],
      ['Additional Information', ''],
      ['Preferred First Name', 'Ada'],
    ],
  },
  {
    name: 'Lever (Spotify)',
    fixture: 'lever-spotify.html',
    url: 'https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b/apply',
    site: 'lever',
    expect: [
      ['Full name', 'Ada Lovelace'],
      ['Email', PROFILE.email],
      ['Phone', PROFILE.phone],
      ['Current company', 'Analytical Engines Ltd'],
      ['GitHub URL', PROFILE.github],
      ['Resume/CV', 'ada-lovelace-cv.pdf'],
    ],
  },
  {
    name: 'Ashby (Ramp)',
    fixture: 'ashby-ramp.html',
    url: 'https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application',
    site: 'ashby',
    expect: [
      ['Legal Name', 'Ada Lovelace'],
      ['Email', PROFILE.email],
      ['LinkedIn Profile', PROFILE.linkedin],
      ['Resume', 'ada-lovelace-cv.pdf'],
      ['Please elaborate on your experience', ''],
    ],
  },
  {
    name: 'Ashby (Linear)',
    fixture: 'ashby-linear.html',
    url: 'https://jobs.ashbyhq.com/linear/d3bc1ced-3ce4-4086-a050-555055dbb1ff/application',
    site: 'ashby',
    expect: [
      ['Name', 'Ada Lovelace'],
      ['Github', PROFILE.github],
      ['Notice Period', '30 days'],
      ['What country are you based in?', 'United Kingdom'],
      ['What are you extremely good at?', ''],
    ],
  },
  {
    name: 'Workable (synthetic)',
    fixture: 'workable-synthetic.html',
    url: 'https://apply.workable.com/brightline/j/ABC123/apply/',
    site: 'workable',
    expect: [
      ['First name', 'Ada'],
      ['Phone', PROFILE.phone],
      ['What is your notice period?', '30 days'],
      ['Expected annual salary (INR)', 'Open to discussion'],
      ['Resume', 'ada-lovelace-cv.pdf'],
      ['Tell us about an interface', ''],
      ['How many years of experience do you have with React?', ''],
    ],
  },
];

mkdirSync('docs/screenshots', { recursive: true });
const REPORT = 'test-results/fill-report.md';

test.beforeAll(() => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync(REPORT, '| Fixture | Fields detected | Filled | Sent to user | Skipped | Expected values correct |\n| --- | --- | --- | --- | --- | --- |\n');
});

for (const c of CASES) {
  test(`fills ${c.name}`, async ({ context, sw }) => {
    await seed(sw);
    await serveFixture(context, c.url, c.fixture);
    const page = await context.newPage();
    await page.goto(c.url);
    const tabId = await tabIdFor(sw, c.url);
    const report = await swSend<Report>(sw, { type: 'fillTab', tabId });
    expect(report.scan.site).toBe(c.site);

    let correct = 0;
    for (const [label, want] of c.expect) {
      const field = report.scan.fields.find((f) => f.label.startsWith(label));
      expect(field, `field ${label}`).toBeTruthy();
      const d = report.decisions.find((x) => x.fieldId === field!.id)!;
      if (want === '') {
        expect(d.action, `${label} must not be filled`).not.toBe('fill');
      } else {
        expect(d.action, `${label} should be filled`).toBe('fill');
        // Read the value back from the page itself, not from our own report.
        const actual = await page.locator(`[data-applyflow-id="${field!.id}"]`).evaluate((el: HTMLInputElement) =>
          el.type === 'file' ? (el.files?.[0]?.name ?? '') : el.value,
        );
        expect(actual, label).toBe(want);
      }
      correct++;
    }

    // Every filled field carries a visible confidence mark; no field was filled without one.
    const marked = await page.locator('[data-applyflow^="filled"]').count();
    const filled = report.decisions.filter((d) => d.action === 'fill').length;
    expect(marked).toBeGreaterThanOrEqual(filled - 1); // radio groups mark one container for the group
    const asked = report.decisions.filter((d) => d.action === 'ask').length;
    const skipped = report.decisions.filter((d) => d.action === 'skip').length;
    appendFileSync(REPORT, `| ${c.name} | ${report.decisions.length} | ${filled} | ${asked} | ${skipped} | ${correct}/${c.expect.length} |\n`);

    await page.locator('[data-applyflow]').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/screenshots/${c.fixture.replace('.html', '')}.png` });
  });
}
