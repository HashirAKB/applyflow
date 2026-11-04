// Message handlers. Kept separate from index.ts so they read top to bottom without chrome event plumbing.

import type { Request, State } from '../core/messages';
import type { Store } from '../storage/store';
import { answerField, fillTab, nextStep } from './fill';

export async function handle(store: Store, msg: Request, _sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (msg.type) {
    case 'getState':
      return getState(store);
    case 'save':
      await store.set(msg.key, msg.value as never);
      return getState(store);
    case 'unlock':
      await store.unlock(msg.passphrase);
      return getState(store);
    case 'lock':
      store.lock();
      return getState(store);
    case 'enableEncryption':
      await store.enableEncryption(msg.passphrase);
      return getState(store);
    case 'disableEncryption':
      await store.disableEncryption();
      return getState(store);
    case 'fillTab':
      return fillTab(store, msg.tabId);
    case 'nextStep':
      return nextStep(store, msg.tabId);
    case 'answerField':
      return answerField(store, msg.tabId, msg.field, msg.questionId, msg.value, msg.remember);
    default:
      throw new Error(`Unknown message ${(msg as { type: string }).type}`);
  }
}

export async function getState(store: Store): Promise<State> {
  const vault = await store.vaultState();
  const settings = await store.get('settings');
  if (vault === 'locked') return { vault, settings };
  const [profile, answers, applications, secrets, resume] = await Promise.all([
    store.get('profile'),
    store.get('answers'),
    store.get('applications'),
    store.get('secrets'),
    store.get('resume'),
  ]);
  return { vault, settings, profile, answers, applications, hasApiKey: !!secrets.llmApiKey, resumeName: resume?.name };
}
