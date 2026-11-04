# Learning applyflow

A guided tour of how applyflow works and why it is built this way. Read it with the code open; file references are clickable on GitHub.

## 1. Manifest V3 architecture

A Chrome extension is several programs that run in different places and talk by message passing.

| Part | File | Runs where | Can do |
| --- | --- | --- | --- |
| Service worker | `src/background/index.ts` | Extension origin, no DOM, suspended when idle | `chrome.storage`, `chrome.scripting`, network to granted hosts |
| Content script | `src/content/index.ts` | Inside a web page, in an isolated world | Read and change the page's DOM; limited `chrome.*` APIs |
| Side panel | `src/sidepanel/*.tsx` | Extension page docked beside the tab | Full extension APIs, React UI |

**Manifest.** `scripts/manifest.mjs` generates `manifest.json`. Permissions are `storage`, `sidePanel` and `scripting`, plus host access to six job sites. Other sites are `optional_host_permissions`, requested at runtime with `chrome.permissions.request` (it must be called from a click handler: Chrome only shows the prompt for a user gesture, see `allow()` in `FillTab.tsx`).

**Service worker lifecycle.** MV3 replaced persistent background pages with a worker that Chrome stops after about 30 seconds idle. Anything in memory disappears. That is why the decryption key is mirrored in `chrome.storage.session` and restored by the `ready` promise at the top of `background/index.ts`, and every message waits for `ready` before running.

**Messaging.** The side panel calls `send()` (`src/sidepanel/api.ts`), a typed wrapper over `chrome.runtime.sendMessage`. The worker's listener returns `true` to keep the channel open for an async `sendResponse`. Message types are a discriminated union in `src/core/messages.ts`, so `handle()` in `src/background/handlers.ts` is a `switch` the compiler checks. The worker drives the content script with `chrome.tabs.sendMessage` (`background/tabs.ts`).

**Injection on demand.** `ensureContentScript()` pings the tab; if nothing answers, it calls `chrome.scripting.executeScript({ files: ['content.js'] })`. The content script guards against double injection with `window.__applyflowLoaded`. If injection fails because the origin is not granted, a `NeedsPermissionError` turns into an "Allow on this site" button.

**Trust.** The worker accepts messages only when `sender.url` is inside the extension. Pages cannot message the extension at all (no `externally_connectable`), and the content script, which lives next to untrusted page code, never asks the worker for data. It only receives the values it must write.

**Build.** `scripts/build.mjs` runs esbuild three times (worker as ESM, content script as an IIFE because content scripts are not modules, side panel as ESM), copies `public/` and the pdf.js worker. `minifySyntax` removes the test-only branch guarded by `__E2E__` while keeping names readable.

## 2. Filling framework-controlled inputs

Setting `input.value = 'Ada'` on a React input appears to work and then silently reverts. React keeps a "value tracker" on each input instance; its `onChange` fires only if the DOM value differs from the tracked value when an `input` event arrives. Assigning through the instance property updates the tracker too, so React sees no change.

The fix in `src/content/fill.ts`:

```ts
const set = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
set.call(el, value);                                  // bypasses the instance tracker
el.dispatchEvent(new Event('input', { bubbles: true }));  // React's onChange
el.dispatchEvent(new Event('change', { bubbles: true })); // Angular, Vue, plain listeners
```

`tests/unit/form-engine.test.tsx` renders a real controlled React input in jsdom and asserts the component state changes.

Other control types:
- `<select>`: native `value` setter on `HTMLSelectElement`, then `input` and `change`.
- Radios and checkboxes: `click()`, because frameworks listen to click for these and it toggles `checked` correctly.
- Files: build a `File`, put it in a `DataTransfer`, assign `input.files`, fire `change`. Only the user's saved resume, only to resume fields.
- Custom dropdowns (react-select on Greenhouse): the menu opens from its keyboard handlers, not from a bare `input` event. `fillCombobox` sends `keydown`, `beforeinput`, `input`, `keyup`, waits for options that belong to that widget (its `aria-controls` list, react-select's id scheme, or options rendered next to it), and clicks the one `matchOption` picks. If nothing matches in 1.5 seconds it clears the text and the field goes to the user. Scoping matters: an early version searched the whole document and picked "United Kingdom" from the phone widget's country list.
- Rich text (Naukri chatbot): set `textContent` and fire an `InputEvent`.

**Finding the question for a field** (`src/content/labels.ts`) follows the accessible-name order: `aria-labelledby`, `<label for>`, wrapping `<label>`, `aria-label`, then layout heuristics (the nearest preceding text in the field's container, stopping at the previous control), the group label for file inputs inside `role="group"`, placeholder, title, and finally the humanised `name` attribute. Button words like "Attach" are skipped. Adapters can override with a `label()` hook when a site's markup misleads (Lever wraps status text inside labels).

**What is never touched** (`detect.ts`): password fields, hidden inputs, invisible fields (honeypots), anything inside a CAPTCHA widget, and fields that already hold a value (the site or user put it there).

## 3. The matching pipeline and confidence

`src/core/matching.ts`, decision record in `docs/adr/0003-matching-pipeline.md`.

```
label ──► memory (1.00) ──► rules (0.95) ──► fuzzy (≤0.90) ──► LLM (≤0.85, optional)
                                                     │
                                     decide(): confidence ≥ threshold? value fits field?
                                                     │
                                         fill │ ask (side panel) │ skip (already filled)
```

- **Canonical questions** (`src/core/canonical.ts`): 47 ids, each with a label, synonyms, regex rules and a source: `profile` (read from the profile), `answer` (answer bank), `resume`, or `generate` (written answers). "Years of experience with X" is parametric: `yearsSkillId()` extracts the skill into ids like `years_skill:react`.
- **Rule order is a precision tool.** `privacy_consent` comes before `notice_period` because "privacy notice" contains "notice". `current_company` patterns are anchored because "employment agreements with your current employer" is not asking for the company name. Both bugs were found on captured real pages.
- **Fuzzy** (`src/core/fuzzy.ts`) averages token Jaccard on stemmed, stop-word-free tokens (word overlap) with character-trigram Dice (robust to typos and word forms). When the top two candidates are different questions within 0.05, confidence is reduced: ambiguity should lower confidence.
- **LLM** sees the question, its options and the id list, and must answer JSON. `parseClassification` accepts only known ids; anything else is "no match". The model's own confidence is scaled by 0.85 so a model can never outrank a rule.
- **`decide()`** turns a match into an action: it pulls the value from the profile or answer bank, maps it onto the field's options with `matchOption` (exact, yes/no polarity, unique containment, then fuzzy with a clear winner), extracts a single number for number inputs, and fills only at or above the threshold. Matches below 0.60 are dropped to "unknown" so a new answer is saved as a new custom question rather than under a wrong guess.
- **Learning.** When the user answers in the side panel, `rememberAnswer` stores the value under the question id and adds the exact label as an alias, so the next site that uses the same wording matches by memory at 1.00.

**Measuring it.** `npm run eval` runs 196 labelled questions through three configurations and reports accuracy, precision at the threshold, coverage and ask rate (`eval/results.md`). Precision is what protects users; CI fails below 0.95.

## 4. Safety design

- **Never guess silently.** Below-threshold fields are listed, never filled. Every filled field is outlined with its confidence (`highlight.ts`).
- **Never overwrite.** Pre-filled fields are skipped.
- **Never invent** (`src/core/guard.ts`, ADR 0005). Drafts may only use profile facts and the job description; `checkGrounding` verifies numbers, names/technologies and credentials against those sources; failing drafts are retried once with feedback, then discarded.
- **Hand control back.** CAPTCHAs and password fields are detected (`findBlockers`) and shown as warnings; auto-submit stops on them; applyflow never interacts with them.
- **Auto-submit** (`src/core/autosubmit.ts`, ADR 0004): off by default, risk screen, per-site opt-in, never on the generic adapter, daily cap counted before the click, pacing between steps, kill switch re-read after the pause, dry run on by default. The gate is a pure function that returns every failed rule, so the user sees exactly why it stopped.
- **Privacy** (PRIVACY.md): local storage, optional AES-GCM vault, LLM calls only to the user's endpoint, redacted diagnostics, CSV formula-injection guard.

## 5. Interview questions, answered from this code

**1. Why is the service worker the only owner of storage?**
It is the one context that is always available to every other part, it can hold the decryption key, and keeping the content script away from storage means a compromised page context cannot read the profile. The content script receives only the values to write (`apply` in `content/index.ts`). The worker also rejects messages whose `sender.url` is not inside the extension.

**2. How do you survive the MV3 worker being killed mid-session?**
State that must survive lives in storage, not memory. The vault key is mirrored to `chrome.storage.session` and restored by the `ready` promise before any message is handled. The auto-submit loop re-reads settings and usage from storage at every step instead of caching them.

**3. Why does `input.value = x` not work on React forms, and what does?**
React's value tracker on the instance swallows the change. Use the prototype's native setter, then dispatch a bubbling `input` event (`setText` in `content/fill.ts`). A jsdom test proves the React state updates.

**4. How do you fill react-select?**
Type through a realistic `keydown`/`beforeinput`/`input`/`keyup` sequence so its handlers open the menu, wait for options scoped to that widget, and click the one `matchOption` picks; otherwise clear and ask (`fillCombobox`). I found the need for the key events by testing on the live Greenhouse page, where a bare `input` event left the menu closed.

**5. How do you decide whether to fill a field?**
`decide()` in `core/matching.ts`: there must be a match at or above the threshold, a stored value, the value must fit the field (an option match or a single number), and the field must be empty. Otherwise the action is `ask`, with the reason shown to the user.

**6. How did you calibrate confidence?**
Each stage has a ceiling (rules 0.95, fuzzy 0.90, LLM 0.85) so a weaker method cannot outrank a stronger one; fuzzy is penalised when two questions tie; the threshold defaults to 0.75 and the eval reports precision at that threshold. With rules alone, 99.4% of automatic fills were correct on 196 questions.

**7. What does the LLM add, and how do you stop it doing damage?**
It bridges wordings with no shared tokens ("How much would you like to earn?" to expected salary). It can only return an id from the candidate list (validated in `parseClassification`), its confidence is capped, it never clicks anything, and failures fall back to fuzzy. For writing, its output must pass the truthfulness guard.

**8. How does the truthfulness guard work, and what are its limits?**
It extracts numbers, capitalised or tech-looking terms and credential words from the draft and requires each to appear in the profile or job description (credentials in the profile). It is lexical, so it cannot catch a false claim made only of common lowercase words, and it can reject a correct proper noun. It is a strict deterministic net under the prompt, not a proof of truth.

**9. Why is auto-submit a pure function?**
So every rule is unit-testable without a browser (`tests/unit/autosubmit.test.ts`) and the result can list every failed rule. The loop in `background/autosubmit.ts` only orchestrates: fill, gate, pause, re-check kill switch, click.

**10. Why count the daily cap before clicking submit?**
If the worker crashed or the page navigated right after the click, a counter written afterwards might never be written, allowing an extra submission. Counting first fails safe.

**11. How do you test an extension end to end?**
Playwright launches Chromium with `--load-extension`, gets the worker from `context.serviceWorkers()`, and serves fixtures at their real URLs with `context.route`, so host permissions, adapter selection and injection behave as in production (`tests/e2e/harness.ts`). An `__E2E__` build flag exposes the worker's handler for tests and is compiled out of the release.

**12. Where did your fixtures come from?**
`scripts/capture-fixture.mjs` loads live public postings, inlines computed visibility (because stylesheets are dropped), and strips scripts. Workable rate-limited the sandbox, so its fixture is hand-built and labelled; LinkedIn and Naukri need logins, so theirs are synthetic and those adapters are marked unverified.

**13. How do you keep personal data out of bug reports?**
`redactTree` in `core/redact.ts` removes values, textarea and rich-text content, selections, scripts, media and unknown attributes, strips URL queries, and replaces text matching any profile or answer value (and emails, phones, long numbers). The e2e test fills a real Lever page and asserts none of the seeded values appear in the export.

**14. Why on-demand injection instead of content scripts on all URLs?**
Least privilege: nothing runs on a page until the user clicks, host access covers six job sites, and other origins are granted one by one. See ADR 0002.

**15. What would you change for a v2?**
A real-model eval row in CI with a budget, confirming the LinkedIn and Naukri adapters with a signed-in tester, embedding-based matching for long free-form questions, and handling date pickers and multi-select widgets beyond ARIA comboboxes.

## 6. Exercises

1. **Add a canonical question.** Add `notice_negotiable` ("Is your notice period negotiable?") to `CATALOGUE`, make sure it is not swallowed by `notice_period` (think about rule order), add five wordings to `eval/questions.tsv`, and run `npm run eval`.
2. **Write an adapter.** Capture a public SmartRecruiters or Recruitee posting with `scripts/capture-fixture.mjs`, write the adapter, and add unit and e2e cases following CONTRIBUTING.md.
3. **Break the guard.** Write three cover-letter sentences that make a false claim but pass `checkGrounding`. Then improve the guard (for example, flag "years" phrases whose number and skill do not co-occur in the profile) without breaking the existing tests.
4. **Date inputs.** `<input type="date">` needs `YYYY-MM-DD`. Make `decide()` normalise stored start dates like "1 March 2027" for date fields, with unit tests for ambiguous formats.
5. **Prove the kill switch.** Write an e2e test that starts `autoApply` with a long pacing delay, flips the kill switch from a second message while it waits, and asserts nothing was submitted.
