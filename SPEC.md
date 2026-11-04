# applyflow specification

## Goal

applyflow is a Chrome extension (Manifest V3) that helps a job seeker fill application forms on the sites they already use, inside their own signed-in browser. It reads the form, matches each field to the user's stored profile and answers, fills what it is confident about, asks the user about the rest, and remembers new answers for next time.

## Non-goals

- No backend, no account, no telemetry, no sync service.
- No password handling, no automated login, no CAPTCHA solving or bypassing, no stealth or anti-detection techniques (no fingerprint spoofing, no `navigator.webdriver` patching, no synthetic mouse paths).
- No crawling or job discovery. The user navigates to the application page themselves.
- No generated content that is not grounded in the user's profile or the job description on the page.

## Architecture

```
src/
  core/        pure TypeScript, no chrome.* APIs, fully unit tested
    profile.ts       profile types and helpers
    canonical.ts     canonical question catalogue (ids, labels, synonyms, kind)
    matching.ts      rules -> fuzzy -> LLM pipeline with confidence
    fuzzy.ts         token and character similarity
    crypto.ts        WebCrypto AES-GCM + PBKDF2 passphrase encryption
    guard.ts         truthfulness guard for generated text
    autosubmit.ts    auto-submit gating (pure decision function)
    tracker.ts       application records + CSV export
    redact.ts        DOM redaction for diagnostics
  llm/         provider interface: Anthropic, OpenAI-compatible, Mock
  storage/     chrome.storage.local wrapper with optional encryption
  content/     content script: field detection, filling, highlighting, adapters
    adapters/       greenhouse, lever, ashby, workable, linkedin, naukri, generic
  background/  service worker: message router, LLM calls, storage owner
  sidepanel/   React UI: fields needing review, profile, answer bank, tracker, settings
```

Data flow for one fill:

1. The user opens the side panel and clicks "Scan and fill" (or the content script receives a `scan` message).
2. The content script picks the adapter for the current URL (`adapter.matches(url, document)`), which returns a list of `DetectedField` (element handle, label text, kind, options, required).
3. The content script sends field descriptors (labels and options only, no element handles) to the service worker.
4. The service worker loads the profile and answer bank, runs the matching pipeline for each field and returns `FieldDecision` (value, confidence, source, canonical id).
5. The content script fills fields whose confidence is at or above the threshold using native value setters plus `input`/`change` events, highlights each with its confidence, and returns the rest as "needs you".
6. The side panel lists unresolved fields. Answers the user gives are filled into the page and saved to the answer bank under the matched canonical id (or as a new custom question).
7. An application record is written to the tracker.

### Matching pipeline

1. Rules: normalised label regexes per canonical question (for example `/notice\s*period/`). Confidence 0.95.
2. Fuzzy: best similarity between the label and every canonical label, synonym, and previously seen user question (token Jaccard with stemming plus character trigram Dice). Confidence is the similarity score, capped at 0.9.
3. LLM (optional): if the best confidence is below the threshold and an LLM provider is configured, the provider classifies the label into one of the canonical ids or `none`, returning a confidence. Only canonical ids from the catalogue are accepted; anything else is treated as `none`.
4. Decision: confidence >= threshold (default 0.75) is auto-filled. Otherwise the field goes to the side panel. A field is never filled with a value that is not the user's stored answer or profile value (options in a select are matched to the stored answer; if no option matches, the field goes to the user).

### Storage

`chrome.storage.local` holds one object per key: `profile`, `answers`, `settings`, `applications`, `autosubmit`. When a passphrase is set, `profile`, `answers` and `applications` are stored as AES-GCM ciphertext (`{v:1, salt, iv, data}`), key derived with PBKDF2-SHA256 (310,000 iterations). The derived key lives only in the service worker memory (and `chrome.storage.session` so it survives worker restarts until the browser closes). Settings stay plaintext because they hold no personal data (the LLM API key is the exception and is stored inside the encrypted vault when encryption is on).

## Threat model

| Threat | Mitigation |
| --- | --- |
| Malicious page reads stored profile | Content script never exposes storage to the page. It runs in an isolated world. Values are only written into form fields the user asked to fill. |
| Malicious page sends messages to the extension | No `externally_connectable`. The service worker only accepts messages from its own extension contexts (`sender.id === chrome.runtime.id`). |
| Prompt injection via job description or labels | LLM output is constrained: classification must return a known canonical id; generated text passes the truthfulness guard; LLM never triggers clicks or submits. |
| Laptop theft or shared profile | Optional passphrase encryption (AES-GCM, PBKDF2). |
| Personal data in logs or bug reports | No `console.log` of values. Diagnostics export runs redaction that replaces every input value and text node that looks like personal data. |
| Remote code | MV3 forbids remote code; all code is bundled. CSP default. No `eval`. |
| Account bans from automation | Auto-submit off by default, per-site opt-in with explicit risk confirmation, daily caps, human-scale delays, kill switch, dry run. No stealth. |
| Silent wrong answers | Below-threshold fields are never filled; every filled field is highlighted with its confidence. |
| LLM key leakage | Key stored locally, sent only to the provider host the user configured. |

## Milestones and success criteria

| # | Milestone | Verifiable success criterion |
| --- | --- | --- |
| M1 | Extension skeleton, storage, encryption | `npm run build` produces `dist/` with a valid MV3 manifest; unit tests prove encrypt/decrypt round trip, wrong passphrase fails, storage wrapper reads back what it writes, encrypted mode stores no plaintext. |
| M2 | Form engine + generic adapter | Unit tests on synthetic HTML: detects text, textarea, select, radio, checkbox, file; label resolution via `for`, wrapping label, `aria-label`, `aria-labelledby`, placeholder, nearby text; fill dispatches events a React-controlled input accepts. |
| M3 | Answer bank + matching + eval | Eval of 150+ labelled questions runs in CI and writes `eval/results.md`; rules+mock LLM has higher accuracy than rules-only, precision at threshold >= 0.95. |
| M4 | Greenhouse, Lever, Ashby, Workable adapters + e2e | Fixtures committed; Playwright loads the built extension in Chromium, fills fixtures, asserts fill accuracy and that unknown fields are not filled. |
| M5 | Side panel UI + onboarding/resume import | Resume text parser unit-tested on PDF and DOCX samples; side panel renders in e2e; profile review/edit saves. |
| M6 | Tracker | Each fill writes a record; status update and CSV export unit-tested (CSV escaping). |
| M7 | LinkedIn Easy Apply + Naukri adapters | Synthetic fixtures; adapters detect fields and multi-step "Next"; marked unverified. |
| M8 | Auto-submit with safeguards | Gating function unit-tested for every rule; e2e proves it is off by default and dry run never submits. |
| M9 | Truthfulness guard + cover letter | Guard unit tests reject invented numbers, skills, employers, credentials; generation with mock provider is grounded; missing grounding asks the user. |
| M10 | Diagnostics | Redacted export contains no profile values (unit + e2e). |
| M11 | Packaging, docs, review | `npm run package` builds `applyflow.zip`; CI green; docs complete; reviewer pass logged. |

## Deviations

Recorded as they happen.
