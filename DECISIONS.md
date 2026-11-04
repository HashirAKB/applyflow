# Decisions

Decisions made without the owner, with alternatives and reasons.

## D1 Build tool: esbuild script instead of Vite/CRXJS
- Alternatives: Vite + @crxjs/vite-plugin, webpack, Plasmo.
- Why: one small `scripts/build.mjs` is easy to read and explain. CRXJS and Plasmo hide how MV3 bundles are wired, which defeats the learning goal. esbuild is fast and has no plugin surface we need.

## D2 Fuzzy matching implemented in-house
- Alternatives: fuse.js, string-similarity.
- Why: about 60 lines (token Jaccard with light stemming plus character trigram Dice). No dependency, fully explainable in an interview, and tuned for short form labels.

## D3 Branch
- The task brief asked for pushes directly to `main`; the session also designated a feature branch. Work is committed on `main` and pushed to `main`, and the same commits are mirrored to the designated branch so both stay identical.

## D4 Test runner: Vitest with jsdom
- Alternatives: Jest.
- Why: native ESM and TypeScript with no Babel config; same API as Jest.

## D5 Anthropic provider uses the official SDK; OpenAI-compatible uses fetch
- Alternatives: raw fetch for both; an OpenAI-compatible shim for Anthropic.
- Why: the SDK gives typed requests and error classes and keeps up with API changes. The OpenAI-compatible provider is a single POST that also serves Groq, Ollama and LM Studio, so a dependency is not worth it there.
- Default Anthropic model `claude-opus-5-5` with `effort: low` for classification; the user can change the model in settings. Server-side refusal fallback is enabled.

## D6 Mock LLM is a concept lexicon
- Alternatives: echoing the expected answer (meaningless), recorded real-model replies (needs a key and goes stale).
- Why: deterministic, offline, reads the same prompt and returns the same JSON as a real provider, so the full parse and confidence path is tested. The eval labels its row clearly as a mock.

## D7 Content script injected on demand
- Alternatives: static content_scripts on every ATS host, or `<all_urls>`.
- Why: nothing runs on a page until the user clicks fill. Dedicated job sites are listed host permissions; any other site is requested per origin at the moment of use (optional_host_permissions).

## D8 Never overwrite a value already on the page
- Why: LinkedIn and others prefill fields from the account. Overwriting would silently replace data the site or user chose.

## D9 Resume parsing is heuristic, no LLM
- Alternatives: send resume text to the configured LLM for structured extraction.
- Why: works with no model configured, keeps the resume on the machine by default, and every parsed field goes through a mandatory review screen. Fields the parser is unsure of stay empty.

## D10 Weak guesses are not hints
- Matches under 0.60 confidence are dropped to "unknown" before deciding. Otherwise a user answer typed for a weakly-matched question would be saved under the wrong canonical question and reused on other sites.

## D11 Bundle size
- The Anthropic SDK makes background.js about 1 MB, and pdf.js plus mammoth make the side panel about 1.5 MB. Acceptable for a locally installed extension; nothing is downloaded at runtime.

## D12 Auto-submit is user-initiated per application
- Alternatives: background queue that applies to many postings unattended.
- Why: the user opens the posting and clicks "Auto-apply"; applyflow never navigates to new postings by itself. This keeps a person in the loop for every application, keeps volume naturally low, and makes the daily cap a backstop rather than the only brake.
- Auto-submit never runs on the generic adapter: an unknown site cannot be trusted to have a recognisable final step.
- The usage counter is incremented before the submit click so a crash after clicking cannot permit an extra submission.
- The pause between automated clicks is pacing (no faster than a person), not concealment. No stealth or anti-detection measures exist anywhere in the code.
