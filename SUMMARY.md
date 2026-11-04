# Summary

## What was built

applyflow, a Manifest V3 Chrome extension (TypeScript, React side panel) that fills job application forms inside the user's own browser from a locally stored profile and answer bank.

- **Storage and privacy:** typed store over `chrome.storage.local`; optional passphrase vault (PBKDF2-SHA256 310k, AES-GCM 256) covering profile, answers, applications, resume and API key; key kept in session memory only.
- **Form engine:** field detection for text, email, phone, number, date, textarea, select, radio and checkbox groups, file inputs, ARIA comboboxes and rich-text boxes; accessible-name label resolution with layout fallbacks; framework-safe filling (native setters plus events; typed event sequence for react-select); per-field confidence outlines; never touches passwords, hidden fields, CAPTCHAs or pre-filled values.
- **Matching:** 47 canonical questions plus parametric "years of X"; memory, rules, fuzzy (token Jaccard plus trigram Dice) and an optional constrained LLM stage; one confidence threshold; answers learned with the exact wording seen.
- **LLM providers:** Anthropic (official SDK), OpenAI-compatible (OpenAI, Groq, Ollama, LM Studio), deterministic mock for tests.
- **Adapters:** Greenhouse, Lever, Ashby, Workable, LinkedIn Easy Apply, Naukri, and a generic heuristic adapter; multi-step "next" support.
- **Side panel:** fill review with answer-and-remember, resume import (PDF via pdf.js, DOCX via mammoth, parsed locally) with a review screen, answer bank editor, tracker, settings.
- **Tracker:** one record per posting with answers used and a job description snapshot; status updates; CSV export with formula-injection guard.
- **Auto-submit:** off by default; risk confirmation; per-site opt-in; pure gate function (kill switch, cap, CAPTCHA/login/unknown step, required fields at threshold); pacing; dry run.
- **Truthfulness guard:** grounded drafting of cover letters and "why us" answers, with a deterministic source check, one feedback retry, and refusal when grounding is missing.
- **Diagnostics:** redacted broken-site export (structure and mapping, no personal values).
- **Quality:** 144 unit tests, 26 Playwright tests against the built extension (23 on fixtures and the UI, 3 live dry runs), a 201-question matching eval, CI on every push, tagged releases with the extension zip.

## Verification status per site

| Site | Status | Evidence |
| --- | --- | --- |
| Greenhouse | Live-tested (dry run) and fixture-tested | Live GitLab posting: 10 of 18 fields filled, dropdown selections verified in react-select's display; 2 captured fixtures |
| Lever | Live-tested (dry run) and fixture-tested | Live Spotify posting: 11 of 15 filled; 2 captured fixtures (Spotify, Palantir) |
| Ashby | Live-tested (dry run) and fixture-tested | Live Ramp posting: 5 of 15 filled (mostly free-text and yes/no questions with no saved answer); 2 captured fixtures |
| Workable | Fixture-tested only | Hand-built fixture; the live site returned HTTP 429 to the build environment |
| LinkedIn Easy Apply | Unverified | Synthetic multi-step fixture built from documented DOM patterns; needs a signed-in tester |
| Naukri | Unverified | Synthetic chatbot fixture built from the documented flow; needs a signed-in tester |
| Other sites (generic) | Fixture-tested | Synthetic careers page |

Live dry runs never submit: applyflow is not asked to submit, and the test aborts any request that looks like a submission or file upload.

## Known gaps

- LinkedIn and Naukri adapters are unconfirmed on the live sites.
- The eval's LLM row uses a mock; no real-model numbers are committed (the script supports one with an API key).
- Date pickers, multi-select widgets that are not ARIA comboboxes, and file uploads other than the resume go to the user.
- Resume parsing is heuristic and tuned on simple single-column layouts.
- Saved answers are not adapted to the form (no currency or unit conversion).
- Chrome only; the side panel API is required.
- The background bundle is about 1 MB because of the Anthropic SDK.

## Resume bullets

- Built applyflow, an open-source Manifest V3 Chrome extension in TypeScript and React that fills job applications from a local profile, with on-demand script injection, per-origin permissions and optional AES-GCM encryption of all personal data.
- Designed a staged question-matching pipeline (rules, fuzzy matching, constrained LLM classification) with calibrated confidence; measured 99.4% precision at the fill threshold on a 201-question labelled eval that gates CI.
- Implemented framework-safe form filling for React-controlled inputs and react-select dropdowns, verified by Playwright tests that load the built extension in Chromium against fixtures captured from live Greenhouse, Lever and Ashby postings and by live dry runs.
- Added safety layers for automation and generation: an opt-in auto-submit gate as a pure, fully unit-tested function (daily caps, CAPTCHA and login stops, dry run, kill switch) and a truthfulness guard that rejects AI-drafted answers containing claims not grounded in the user's profile.
