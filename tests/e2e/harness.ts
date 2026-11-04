// Loads the built extension into Chromium and serves fixtures under their real job-site URLs
// (Playwright intercepts the request), so host permissions and adapter URL matching are exercised as in production.
import { test as base, chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EXT = path.resolve('dist');

export const test = base.extend<{ context: BrowserContext; sw: Worker; extensionId: string }>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
    });
    await use(context);
    await context.close();
  },
  sw: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ sw }, use) => {
    await use(new URL(sw.url()).host);
  },
});

export const expect = test.expect;

/** Serve a fixture file at a real URL. Any other request on that host gets an empty 204. */
export async function serveFixture(context: BrowserContext, url: string, fixture: string) {
  const html = readFileSync(path.resolve('tests/fixtures', fixture), 'utf8');
  const u = new URL(url);
  await context.route(`${u.origin}/**`, (route) => {
    const r = new URL(route.request().url());
    if (r.pathname === u.pathname && route.request().resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

/** Run a message through the service worker as the side panel would. */
export async function swSend<T>(sw: Worker, msg: unknown): Promise<T> {
  return sw.evaluate(async (m) => {
    // Inside the worker we call the same handler the onMessage listener uses.
    const res = await (globalThis as unknown as { __applyflowHandle: (m: unknown) => Promise<unknown> }).__applyflowHandle(m);
    return res;
  }, msg) as Promise<T>;
}

export async function tabIdFor(sw: Worker, url: string): Promise<number> {
  return sw.evaluate(async (u) => {
    const tabs = await chrome.tabs.query({});
    const t = tabs.find((x) => x.url?.startsWith(u));
    if (!t?.id) throw new Error(`no tab for ${u}`);
    return t.id;
  }, url);
}

export async function openPanel(context: BrowserContext, extensionId: string, tabId: number): Promise<Page> {
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/sidepanel.html?tabId=${tabId}`);
  return panel;
}
