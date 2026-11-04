// Talking to the content script in a tab, injecting it first if needed.
import type { Response, TabRequest } from '../core/messages';

export class NeedsPermissionError extends Error {
  constructor(public readonly origin: string) {
    super(`applyflow needs permission to read forms on ${origin}`);
  }
}

export async function tabSend<T>(tabId: number, msg: TabRequest): Promise<T> {
  const res = (await chrome.tabs.sendMessage(tabId, msg)) as Response<T> | undefined;
  if (!res) throw new Error('The page did not answer. Reload it and try again.');
  if (!res.ok) throw new Error(res.error);
  return res.result;
}

/** Inject the content script on demand. Requires host permission for the tab's origin. */
export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await tabSend(tabId, { type: 'ping' });
    return;
  } catch {
    // not injected yet
  }
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  } catch (e) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const origin = tab?.url ? new URL(tab.url).origin : '';
    if (origin.startsWith('http')) throw new NeedsPermissionError(origin);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
