# ADR 0002: Inject the content script on demand, with minimal host access

Status: accepted (2026-11-04)

## Context
The extension must work "on any site the user is signed into" but should not run on, or be able to read, every page the user visits.

## Decision
No static `content_scripts`. The service worker injects `content.js` with `chrome.scripting.executeScript` when the user clicks Scan and fill. Host permissions cover only the six supported job sites; any other origin is requested with `chrome.permissions.request` at the moment the user clicks "Allow on this site" (from `optional_host_permissions`). The LLM endpoint is requested the same way when saved in settings. The worker only accepts messages from extension pages; the content script never calls it.

## Alternatives
- `<all_urls>` content scripts: simplest, but runs on every page and makes the extension a much larger target.
- `activeTab`: grants access only on a toolbar click and is lost on navigation, which breaks multi-step forms driven from the side panel.

## Consequences
One extra click the first time on a non-supported site. Nothing executes in a page until the user asks. Store review is easier to justify.
