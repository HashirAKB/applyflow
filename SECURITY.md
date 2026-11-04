# Security

## Reporting a vulnerability

Please open a private security advisory on GitHub (Security tab, "Report a vulnerability") rather than a public issue. Include steps to reproduce and the affected version. You should get a response within a week.

## Security model

**Trust boundaries.** Web pages are untrusted. The content script runs in Chrome's isolated world, cannot be called by the page, and never has access to storage: it only receives the values to write into fields the user asked to fill. The service worker owns storage and the decryption key and only answers messages from the extension's own pages (`sender.url` must be inside the extension). There is no `externally_connectable`, so other extensions and websites cannot message it.

**Least privilege.** Host access is limited to the six supported job sites. Every other site, and the LLM endpoint, is requested per origin at the moment the user needs it. The content script is injected on demand, not declared on all pages.

**No remote code.** All code is bundled at build time and the default MV3 content security policy applies (no `eval`, no remote scripts). Some bundled libraries (pdf.js, mammoth's dependencies) contain `new Function` feature probes; the CSP blocks them and pdf.js is configured with `isEvalSupported: false`. The release build is not minified so it can be reviewed.

**Untrusted text reaching the LLM.** Form labels and job descriptions come from web pages and may contain prompt injection. Mitigations: classification output is parsed as JSON and only known question ids are accepted; generated text must pass the truthfulness guard against the user's own profile; the LLM never triggers clicks, navigation or submission; prompts tell the model to ignore instructions in page content.

**Encryption at rest (optional).** AES-GCM 256 with a key derived by PBKDF2-SHA256 (310,000 iterations, random 16-byte salt, random 12-byte IV per write). A known-plaintext check value verifies the passphrase without decrypting user data.

**Data in exports.** CSV export neutralises spreadsheet formula injection (cells starting with `=`, `+`, `-`, `@` are prefixed). The broken-site report is redacted; see PRIVACY.md.

**Automation safety.** No password handling, no login automation, no CAPTCHA interaction, no anti-detection. Auto-submit is off by default and gated (see README).

**Logging.** The code does not log personal data; `console.log` is banned by lint.

## Known limitations

- `chrome.storage.local` is readable by anyone with access to your unlocked computer and Chrome profile. Turn on encryption if that matters to you.
- While the vault is unlocked, the key lives in session memory until the browser closes or you click Lock.
- An LLM API key is sent directly from the browser to the provider (`dangerouslyAllowBrowser` in the Anthropic SDK). This is appropriate for a key that belongs to the user running the extension; never ship a shared key this way.
