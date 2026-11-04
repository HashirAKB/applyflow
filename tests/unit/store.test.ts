// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decryptJson, deriveKey, encryptJson, randomBytes } from '../../src/core/crypto';
import { LockedError, MemoryKV, Store, WrongPassphraseError } from '../../src/storage/store';
import { emptyProfile } from '../../src/core/types';

const profile = { ...emptyProfile(), firstName: 'Ada', email: 'ada@example.com' };

describe('crypto', () => {
  it('round trips JSON', async () => {
    const key = await deriveKey('correct horse battery', randomBytes(16));
    const blob = await encryptJson(key, { a: 1, b: ['x'] });
    expect(await decryptJson(key, blob)).toEqual({ a: 1, b: ['x'] });
  });

  it('uses a fresh IV for each encryption', async () => {
    const key = await deriveKey('correct horse battery', randomBytes(16));
    const a = await encryptJson(key, 'same');
    const b = await encryptJson(key, 'same');
    expect(a.iv).not.toEqual(b.iv);
    expect(a.data).not.toEqual(b.data);
  });

  it('fails with the wrong key', async () => {
    const salt = randomBytes(16);
    const blob = await encryptJson(await deriveKey('right passphrase', salt), 'secret');
    await expect(decryptJson(await deriveKey('wrong passphrase', salt), blob)).rejects.toThrow();
  });

  it('detects tampering', async () => {
    const key = await deriveKey('right passphrase', randomBytes(16));
    const blob = await encryptJson(key, 'secret');
    const bytes = atob(blob.data).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 1);
    await expect(decryptJson(key, { ...blob, data: btoa(bytes.join('')) })).rejects.toThrow();
  });
});

describe('Store', () => {
  it('returns defaults and reads back what it writes', async () => {
    const store = new Store(new MemoryKV());
    expect((await store.get('settings')).threshold).toBe(0.75);
    expect(await store.get('answers')).toEqual([]);
    await store.set('profile', profile);
    expect(await store.get('profile')).toEqual(profile);
  });

  it('merges new default settings into older saved settings', async () => {
    const kv = new MemoryKV();
    await kv.set('settings', { threshold: 0.8 });
    const s = await new Store(kv).get('settings');
    expect(s.threshold).toBe(0.8);
    expect(s.autoSubmit.enabled).toBe(false);
  });

  it('stores no plaintext personal data once encryption is enabled', async () => {
    const kv = new MemoryKV();
    const store = new Store(kv);
    await store.set('profile', profile);
    await store.set('answers', [{ questionId: 'notice_period', value: '30 days', aliases: [], updatedAt: '' }]);
    await store.enableEncryption('a long passphrase');
    const dump = JSON.stringify([...kv.data.entries()]);
    expect(dump).not.toContain('Ada');
    expect(dump).not.toContain('ada@example.com');
    expect(dump).not.toContain('30 days');
    expect((await store.get('profile')).firstName).toBe('Ada');
    await store.set('profile', { ...profile, firstName: 'Grace' });
    expect(JSON.stringify([...kv.data.entries()])).not.toContain('Grace');
  });

  it('locks, refuses access while locked and unlocks with the right passphrase only', async () => {
    const kv = new MemoryKV();
    const store = new Store(kv);
    await store.set('profile', profile);
    await store.enableEncryption('a long passphrase');
    store.lock();
    expect(await store.vaultState()).toBe('locked');
    await expect(store.get('profile')).rejects.toBeInstanceOf(LockedError);
    await expect(store.set('profile', profile)).rejects.toBeInstanceOf(LockedError);
    await expect(store.unlock('not the passphrase')).rejects.toBeInstanceOf(WrongPassphraseError);
    await store.unlock('a long passphrase');
    expect(await store.vaultState()).toBe('unlocked');
    expect((await store.get('profile')).email).toBe('ada@example.com');
    // settings are never encrypted so the extension can start while locked
    store.lock();
    expect((await store.get('settings')).threshold).toBe(0.75);
  });

  it('disables encryption back to plaintext', async () => {
    const kv = new MemoryKV();
    const store = new Store(kv);
    await store.set('profile', profile);
    await store.enableEncryption('a long passphrase');
    await store.disableEncryption();
    expect(await store.vaultState()).toBe('off');
    expect(kv.data.get('profile')).toEqual(profile);
  });

  it('rejects short passphrases', async () => {
    await expect(new Store(new MemoryKV()).enableEncryption('short')).rejects.toThrow();
  });
});
