// Thin typed wrapper over chrome.runtime.sendMessage for the side panel.
import type { Request, Response } from '../core/messages';

export async function send<T>(msg: Request): Promise<T> {
  const res = (await chrome.runtime.sendMessage(msg)) as Response<T> | undefined;
  if (!res) throw new Error('No response from the extension background.');
  if (!res.ok) throw new Error(res.error);
  return res.result;
}
