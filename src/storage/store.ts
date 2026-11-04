// Typed key-value store with optional passphrase encryption.
// The backing KV is chrome.storage.local in the extension and an in-memory map in tests.

import {
  decryptJson,
  deriveKey,
  encryptJson,
  fromBase64,
  isEncryptedBlob,
  randomBytes,
  toBase64,
  type EncryptedBlob,
} from '../core/crypto';
import {
  defaultSettings,
  emptyProfile,
  type Answer,
  type ApplicationRecord,
  type Profile,
  type Secrets,
  type Settings,
} from '../core/types';
import type { ResumeFile } from '../core/messages';

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

export class MemoryKV implements KV {
  readonly data = new Map<string, unknown>();
  async get(key: string) {
    const v = this.data.get(key);
    return v === undefined ? undefined : structuredClone(v);
  }
  async set(key: string, value: unknown) {
    this.data.set(key, structuredClone(value));
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}

/** Per-site, per-day auto-submit counter. */
export interface Usage {
  [site: string]: { date: string; count: number };
}

export interface Schema {
  profile: Profile;
  answers: Answer[];
  applications: ApplicationRecord[];
  secrets: Secrets;
  settings: Settings;
  usage: Usage;
  resume: ResumeFile | null;
}

/** Keys holding personal data. These are encrypted when the vault is enabled. */
export const SECRET_KEYS = ['profile', 'answers', 'applications', 'secrets', 'resume'] as const;
type SecretKey = (typeof SECRET_KEYS)[number];

const DEFAULTS: { [K in keyof Schema]: () => Schema[K] } = {
  profile: emptyProfile,
  answers: () => [],
  applications: () => [],
  secrets: () => ({ llmApiKey: '' }),
  settings: defaultSettings,
  usage: () => ({}),
  resume: () => null,
};

interface VaultMeta {
  salt: string;
  /** Encrypted known value, used to check the passphrase without touching user data. */
  check: EncryptedBlob;
}

const VAULT_KEY = 'vault';
const CHECK_VALUE = 'applyflow-vault-check';

export class LockedError extends Error {
  constructor() {
    super('The vault is locked. Unlock it with your passphrase.');
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('Wrong passphrase.');
  }
}

export type VaultState = 'off' | 'locked' | 'unlocked';

function isSecret(name: keyof Schema): name is SecretKey {
  return (SECRET_KEYS as readonly string[]).includes(name);
}

export class Store {
  private key: CryptoKey | null = null;

  constructor(private readonly kv: KV) {}

  async vaultState(): Promise<VaultState> {
    const meta = await this.kv.get(VAULT_KEY);
    if (!meta) return 'off';
    return this.key ? 'unlocked' : 'locked';
  }

  /** The in-memory key, so the service worker can park it in chrome.storage.session. */
  currentKey(): CryptoKey | null {
    return this.key;
  }

  setKey(key: CryptoKey | null) {
    this.key = key;
  }

  async get<K extends keyof Schema>(name: K): Promise<Schema[K]> {
    const raw = await this.kv.get(name);
    if (raw === undefined) return DEFAULTS[name]();
    if (isEncryptedBlob(raw)) {
      if (!this.key) throw new LockedError();
      return decryptJson<Schema[K]>(this.key, raw);
    }
    if (name === 'settings') return { ...defaultSettings(), ...(raw as Settings) } as Schema[K];
    return raw as Schema[K];
  }

  async set<K extends keyof Schema>(name: K, value: Schema[K]): Promise<void> {
    if (isSecret(name) && (await this.kv.get(VAULT_KEY))) {
      if (!this.key) throw new LockedError();
      await this.kv.set(name, await encryptJson(this.key, value));
      return;
    }
    await this.kv.set(name, value);
  }

  async update<K extends keyof Schema>(name: K, fn: (current: Schema[K]) => Schema[K]): Promise<Schema[K]> {
    const next = fn(await this.get(name));
    await this.set(name, next);
    return next;
  }

  /** Turn on encryption: every secret key is rewritten as ciphertext. */
  async enableEncryption(passphrase: string): Promise<void> {
    if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
    if (await this.kv.get(VAULT_KEY)) throw new Error('Encryption is already enabled.');
    const plain = await Promise.all(SECRET_KEYS.map((k) => this.kv.get(k)));
    const salt = randomBytes(16);
    const key = await deriveKey(passphrase, salt);
    for (let i = 0; i < SECRET_KEYS.length; i++) {
      if (plain[i] !== undefined) await this.kv.set(SECRET_KEYS[i], await encryptJson(key, plain[i]));
    }
    const meta: VaultMeta = { salt: toBase64(salt), check: await encryptJson(key, CHECK_VALUE) };
    await this.kv.set(VAULT_KEY, meta);
    this.key = key;
  }

  async unlock(passphrase: string): Promise<void> {
    const meta = (await this.kv.get(VAULT_KEY)) as VaultMeta | undefined;
    if (!meta) return;
    const key = await deriveKey(passphrase, fromBase64(meta.salt));
    try {
      if ((await decryptJson<string>(key, meta.check)) !== CHECK_VALUE) throw new Error();
    } catch {
      throw new WrongPassphraseError();
    }
    this.key = key;
  }

  lock() {
    this.key = null;
  }

  /** Turn off encryption: requires the vault to be unlocked, rewrites secrets as plaintext. */
  async disableEncryption(): Promise<void> {
    if (!(await this.kv.get(VAULT_KEY))) return;
    if (!this.key) throw new LockedError();
    for (const k of SECRET_KEYS) {
      const raw = await this.kv.get(k);
      if (isEncryptedBlob(raw)) await this.kv.set(k, await decryptJson(this.key, raw));
    }
    await this.kv.remove(VAULT_KEY);
    this.key = null;
  }
}
