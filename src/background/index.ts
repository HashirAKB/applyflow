// Service worker: the only context that owns storage and the decryption key.
// The side panel and content script talk to it with chrome.runtime messages.

import { exportKey, importKey } from '../core/crypto';
import type { Request } from '../core/messages';
import { chromeLocalKV } from '../storage/chromeKv';
import { Store } from '../storage/store';
import { handle } from './handlers';

const store = new Store(chromeLocalKV);
const SESSION_KEY = 'vaultKey';

// Restore the vault key after the worker was suspended. chrome.storage.session is memory-only and is
// not readable by content scripts (default access level is TRUSTED_CONTEXTS).
const ready = (async () => {
  const s = await chrome.storage.session.get(SESSION_KEY);
  const raw = s[SESSION_KEY];
  if (typeof raw === 'string') store.setKey(await importKey(raw));
})();

async function persistKey() {
  const key = store.currentKey();
  if (key) await chrome.storage.session.set({ [SESSION_KEY]: await exportKey(key) });
  else await chrome.storage.session.remove(SESSION_KEY);
}

declare const __E2E__: boolean;
if (__E2E__) {
  // Test-only hook so Playwright can drive the worker the way the side panel does. Compiled out of release builds.
  (globalThis as Record<string, unknown>).__applyflowHandle = (msg: Request) =>
    ready.then(() => handle(store, msg, { id: chrome.runtime.id }));
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((msg: Request, sender, sendResponse) => {
  // Only our own extension pages (the side panel) may talk to the worker. Content scripts never
  // need to, so a compromised page context cannot read the profile. There is no externally_connectable.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(''))) return false;
  ready
    .then(() => handle(store, msg, sender))
    .then(async (result) => {
      if (msg.type === 'unlock' || msg.type === 'lock' || msg.type === 'enableEncryption' || msg.type === 'disableEncryption') {
        await persistKey();
      }
      sendResponse({ ok: true, result });
    })
    .catch((e: unknown) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  return true; // async response
});
