# Chrome Web Store listing

## Name
applyflow

## Summary (132 characters max)
Fill job applications from your own profile. Local-first, asks before guessing, never invents answers. Auto-submit off by default.

## Category
Productivity

## Description

applyflow helps you fill job application forms on the sites you already use, inside your own signed-in browser.

Open an application, click Scan and fill, and applyflow:
- reads every question on the form,
- fills what it is confident about from your profile and saved answers,
- outlines each filled field with its confidence,
- lists everything else in the side panel for you to answer,
- remembers each new answer for the next application.

Built for trust:
- Local-first: your profile, answers, resume and application history stay in your browser. Optional passphrase encryption. No account, no server, no tracking.
- Never guesses silently: low-confidence and unknown questions always come to you.
- Never invents: drafted cover letters and "why this company" answers use only facts from your profile and the job description, checked by a truthfulness guard.
- No shortcuts: it never handles passwords, never logs in for you, never touches CAPTCHAs.

Also included:
- Import your resume (PDF or DOCX), parsed on your computer, to build your profile.
- Application tracker with status and CSV export.
- Optional language model of your choice (Anthropic, OpenAI, Groq, or a local model with Ollama or LM Studio) for unusual questions and drafts.
- Report a broken site: a redacted snapshot with no personal data, for bug reports.

Works on Greenhouse, Lever, Ashby and Workable, and on most other career sites with one click to allow access. LinkedIn Easy Apply and Naukri support is included but not yet verified on the live sites.

Auto-submit is off by default. Turning it on requires a per-site opt-in and a risk confirmation: some sites, including LinkedIn, prohibit automated activity in their terms, and the risk to your account is yours. Even then it submits only when every required field is confidently filled, never on a CAPTCHA, login or unknown step, at most 10 times a day per site, with a dry-run mode and a kill switch.

Open source (MIT): https://github.com/HashirAKB/applyflow

## Single purpose
Help the user fill job application forms with their own saved information.

## Permission justifications
- storage: save the user's profile, answers, settings and application history locally.
- sidePanel: the extension's user interface.
- scripting: inject the form-filling script into the current tab only when the user clicks Scan and fill.
- Host permissions (Greenhouse, Lever, Ashby, Workable, LinkedIn, Naukri): read and fill application forms on these job sites.
- Optional host permissions: requested per site at the user's request, to fill forms on other career sites and to reach the LLM endpoint the user configures.

## Data usage disclosures
- Collects: personally identifiable information, and user-provided content (resume, answers), stored only on the user's device.
- Not sold, not transferred to third parties, not used for purposes unrelated to the single purpose.
- Sent only to the language model endpoint the user configures, when they configure one.

## Privacy policy URL
https://github.com/HashirAKB/applyflow/blob/main/PRIVACY.md

## Screenshots
docs/screenshots/hero.png, docs/screenshots/sidepanel-fill.png, docs/screenshots/sidepanel-profile.png, docs/screenshots/sidepanel-draft.png
