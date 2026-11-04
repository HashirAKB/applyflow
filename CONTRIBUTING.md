# Contributing

Thanks for helping. The most valuable contribution is a site adapter, or a fix for a site that fills badly.

## Setup

```bash
npm ci
npm run check      # lint, typecheck, unit tests
npm run test:e2e   # builds with the test host and runs Playwright with the real extension
```

Keep the build green, keep the code simple, and add a test with every change.

## How to add a site adapter

An adapter only knows *where things are* on one site. Detection, matching and filling are shared.

1. **Capture a fixture.** For a public posting:

   ```bash
   node scripts/capture-fixture.mjs "<application page URL>" tests/fixtures/<site>-<company>.html
   ```

   This saves the rendered DOM with computed visibility inlined and scripts, styles and SVGs removed. Never submit a real application while capturing. For sites that need a login, hand-build a synthetic fixture from the documented markup and say so in a comment at the top of the file.

2. **Write the adapter** in `src/content/adapters/<site>.ts` implementing `SiteAdapter` (`src/content/adapters/types.ts`):

   ```ts
   export const mysite: SiteAdapter = {
     id: 'mysite',
     name: 'My Site',
     verification: 'fixture-tested', // or 'unverified' if you could not test it on the real site
     matches: (url) => url.hostname === 'jobs.mysite.com',
     formRoot: (doc) => doc.querySelector('form#apply'),
     jobInfo: (doc) => ({ company: '...', role: '...', description: '...' }),
     submitButton: (root) => root.querySelector('button[type="submit"]'),
     nextButton: () => null,
   };
   ```

   Optional hooks, only when the generic behaviour is wrong:
   - `label(el)`: the question text when labels are unusual (see `lever.ts`).
   - `skipSelector`: containers to ignore, such as resume-autofill dropzones (see `ashby.ts`).
   - `customFields(root)`: widgets that are not inputs, such as yes/no button pairs (`ashby.ts`) or chat-style questions (`naukri.ts`).
   - `nextMaySubmit`: set when "next" can complete the application, so auto-submit gates it like submit.

3. **Register it** in `src/content/adapters/index.ts` before `generic`.

4. **Grant host access** by adding the site to `ADAPTER_HOSTS` in `scripts/manifest.mjs`, and add it to the auto-submit site list in `src/sidepanel/AutoSubmitSettings.tsx`.

5. **Test it.**
   - Unit: add a case to `tests/unit/adapters.test.ts` asserting the adapter, job info, and the question each important field maps to.
   - E2E: add a case to `tests/e2e/ats.spec.ts` with the fixture served at its real URL and the expected values after filling, including fields that must *not* be filled.

6. **Update the supported sites table** in README.md with an honest verification status.

## Fixing a broken site from a user report

The "Report a broken site" JSON contains `html` (redacted form markup) and `fields` (label, kind, options, matched question, confidence). Save the `html` into a fixture, reproduce the problem in `tests/unit/adapters.test.ts`, then fix the adapter or the shared detector.

## Matching changes

If you change rules in `src/core/canonical.ts` or the matcher, run `npm run eval`. CI fails if precision at the threshold drops below 0.95. Add new real-world wordings to `eval/questions.tsv`.

## Rules for this project

- Never add password handling, login automation, CAPTCHA solving or anti-detection code.
- Never fill a field with a value that is not the user's own saved data (or a draft that passed the truthfulness guard).
- No new permissions without a clear reason in the pull request.
- No personal data in logs, fixtures or test output. Use the fictional people in `tests/e2e/seed.ts`.
