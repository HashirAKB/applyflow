# ADR 0001: Local-first storage with optional passphrase encryption

Status: accepted (2026-11-04)

## Context
A job seeker's profile, salary answers, EEO answers and application history are sensitive. The product must be installable by anyone and trusted, with no operator who could leak or misuse data.

## Decision
Store everything in `chrome.storage.local`, owned by the service worker. Offer optional encryption of every personal-data key with AES-GCM 256, key derived from a passphrase by PBKDF2-SHA256 (310,000 iterations). The key is kept in memory and `chrome.storage.session` (memory-only, trusted contexts only) until the browser closes or the user locks. Settings stay plaintext so the extension can start while locked.

## Alternatives
- A backend with accounts and sync: convenient, but creates a honeypot and an operator the user must trust.
- IndexedDB: more capacity, but `chrome.storage` is simpler, works in the service worker and the side panel, and is enough for a profile, a few hundred answers and a resume.
- Mandatory encryption: safer by default, but a forgotten passphrase loses everything; most users are better served by an informed opt-in.

## Consequences
No sync between devices. Losing the passphrase loses encrypted data. All reads go through `Store`, which makes the encrypted and plaintext paths easy to test with an in-memory KV.
