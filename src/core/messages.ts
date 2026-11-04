// Message contracts between the side panel, service worker and content script.

import type { FieldDecision, FieldDescriptor } from './fields';
import type { Answer, ApplicationRecord, Profile, Settings } from './types';
import type { VaultState } from '../storage/store';

export interface ResumeFile {
  name: string;
  type: string;
  base64: string;
}

export type SaveKey = 'profile' | 'answers' | 'settings' | 'applications' | 'secrets' | 'resume';

/** Requests handled by the service worker. */
export type Request =
  | { type: 'getState' }
  | { type: 'save'; key: SaveKey; value: unknown }
  | { type: 'unlock'; passphrase: string }
  | { type: 'lock' }
  | { type: 'enableEncryption'; passphrase: string }
  | { type: 'disableEncryption' }
  | { type: 'match'; fields: FieldDescriptor[] }
  | { type: 'fillTab'; tabId: number }
  | { type: 'nextStep'; tabId: number }
  | { type: 'answerField'; tabId: number; field: FieldDescriptor; questionId: string | null; value: string; remember: boolean }
  | { type: 'generate'; tabId: number; field: FieldDescriptor }
  | { type: 'diagnostics'; tabId: number };

export interface State {
  vault: VaultState;
  settings: Settings;
  /** Present only when the vault is off or unlocked. */
  profile?: Profile;
  answers?: Answer[];
  applications?: ApplicationRecord[];
  hasApiKey?: boolean;
  resumeName?: string;
}

/** Requests the service worker sends to the content script in a tab. */
export type TabRequest =
  | { type: 'ping' }
  | { type: 'scan' }
  | { type: 'apply'; decisions: FieldDecision[]; resume: ResumeFile | null }
  | { type: 'setField'; fieldId: string; value: string; resume: ResumeFile | null }
  | { type: 'submit'; dryRun: boolean }
  | { type: 'next' }
  | { type: 'diagnose' };

export interface JobInfo {
  company: string;
  role: string;
  description: string;
}

export interface ScanResult {
  site: string;
  siteName: string;
  url: string;
  fields: FieldDescriptor[];
  job: JobInfo;
  /** 'captcha' and/or 'login'. Any blocker hands control to the user. */
  blockers: string[];
  hasNext: boolean;
  hasSubmit: boolean;
  /** Clicking next may complete the application (Naukri chatbot). */
  nextMaySubmit: boolean;
  verification: 'live-tested' | 'fixture-tested' | 'unverified';
}

export interface ApplyResult {
  decisions: FieldDecision[];
}

export type Response<T> = { ok: true; result: T } | { ok: false; error: string };
