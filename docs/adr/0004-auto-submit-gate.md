# ADR 0004: Auto-submit as an opt-in, pure gating function

Status: accepted (2026-11-04)

## Context
Automatic submission is the riskiest feature: a wrong answer cannot be taken back, and some sites' terms prohibit automation.

## Decision
Off by default. Enabling needs a one-time risk confirmation and a per-site opt-in; dry run is on by default. The decision "may we click?" is a pure function, `gate()` in `src/core/autosubmit.ts`, that returns either an action or the full list of failed rules: kill switch, risk acknowledged, site enabled (never generic), daily cap, no CAPTCHA, no login prompt, a recognisable step, and every required field filled at or above the threshold. The service worker loop calls it before every click, pauses a human-scale interval, re-checks the kill switch, and increments the daily counter before clicking submit. Runs start only from a user click on a posting the user opened.

## Alternatives
- Gate logic spread through the content script and UI: harder to test and to reason about.
- Unattended batch applying: rejected; it removes the human from each application and invites account bans.

## Consequences
Every safeguard has a unit test, and the e2e suite proves "off by default" and "dry run never submits" against the built extension.
