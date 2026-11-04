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
