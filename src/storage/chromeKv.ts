import type { KV } from './store';

/** chrome.storage.local as a KV. Only extension pages and the service worker use it. */
export const chromeLocalKV: KV = {
  async get(key) {
    const r = await chrome.storage.local.get(key);
    return r[key];
  },
  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },
  async remove(key) {
    await chrome.storage.local.remove(key);
  },
};
