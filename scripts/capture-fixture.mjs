// Saves the rendered DOM of a live public application page as a test fixture.
// Usage: node scripts/capture-fixture.mjs <url> <out.html> [click-text]
// Scripts are stripped so the fixture is static; markup, labels and attributes are kept as rendered.
// Never submits anything.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const [url, out, clickText] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 2000 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
if (clickText) {
  await page.getByText(clickText, { exact: false }).first().click();
  await page.waitForTimeout(3000);
}
await page.waitForSelector('input, textarea, select', { timeout: 30_000 });
const html = await page.evaluate(() => {
  // Stylesheets are dropped below, so bake the computed visibility into inline styles first.
  for (const el of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') el.style.display = 'none';
    else if (cs.visibility === 'hidden') el.style.visibility = 'hidden';
  }
  const doc = document.documentElement.cloneNode(true);
  doc.querySelectorAll('script, noscript, link[rel="preload"], link[rel="modulepreload"]').forEach((n) => n.remove());
  // Keep stylesheets out too: fixtures load offline.
  doc.querySelectorAll('link[rel="stylesheet"], style, svg').forEach((n) => n.remove());
  return '<!doctype html>\n' + doc.outerHTML;
});
const header = `<!-- Captured from ${url} on ${new Date().toISOString().slice(0, 10)} by scripts/capture-fixture.mjs. Scripts, styles and SVGs removed; computed visibility inlined. -->\n`;
writeFileSync(out, header + html);
console.log(`saved ${out} (${html.length} bytes)`);
await browser.close();
