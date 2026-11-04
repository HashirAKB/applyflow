// Content script. Injected on demand by the service worker, only when the user asks to fill a page.
import type { TabRequest } from '../core/messages';

declare global {
  interface Window {
    __applyflowLoaded?: boolean;
  }
}

if (!window.__applyflowLoaded) {
  window.__applyflowLoaded = true;
  chrome.runtime.onMessage.addListener((msg: TabRequest, _sender, sendResponse) => {
    if (msg.type === 'ping') sendResponse({ ok: true, result: 'pong' });
    return false;
  });
}
