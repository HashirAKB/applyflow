// Passphrase encryption with WebCrypto: PBKDF2-SHA256 key derivation, AES-GCM 256 encryption.
// Works in the service worker, the side panel and Node 20+ (globalThis.crypto).

export const PBKDF2_ITERATIONS = 310_000;

export interface EncryptedBlob {
  v: 1;
  iv: string; // base64, 12 bytes
  data: string; // base64 ciphertext with GCM tag
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

/**
 * Derive an AES-GCM key from a passphrase. The key is extractable only so the service worker
 * can keep the raw bytes in chrome.storage.session (memory only, cleared when the browser closes).
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(raw), 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Throws if the key is wrong or the ciphertext was tampered with (GCM authentication). */
export async function decryptJson<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(blob.iv) }, key, fromBase64(blob.data));
  return JSON.parse(dec.decode(plain)) as T;
}

export function isEncryptedBlob(x: unknown): x is EncryptedBlob {
  return !!x && typeof x === 'object' && (x as EncryptedBlob).v === 1 && typeof (x as EncryptedBlob).iv === 'string';
}
