# Privacy

applyflow is local-first. It has no server, no account and no analytics. This page lists exactly what it stores and what it sends.

## What is stored

All data is stored in `chrome.storage.local`, inside your Chrome profile on your computer.

| Key | Contents | Encrypted when a passphrase is set |
| --- | --- | --- |
| `profile` | Name, email, phone, location, links, summary, skills, experience, education | Yes |
| `answers` | Your answers to application questions, and the question wordings you answered them under | Yes |
| `applications` | Tracker records: company, role, URL, date, status, the answers used, a snapshot of the job description (up to 20,000 characters) | Yes |
| `resume` | The resume file you imported (so it can be attached to applications) | Yes |
| `secrets` | Your LLM API key, if you set one | Yes |
| `settings` | Confidence threshold, LLM provider, model and endpoint URL, auto-submit settings | No (contains no personal data) |
| `usage` | Per-site count of auto-submissions today, for the daily cap | No |
| `vault` | Salt and a check value for the passphrase (never the passphrase itself) | n/a |

When encryption is on, the key derived from your passphrase (PBKDF2-SHA256, 310,000 iterations, AES-GCM 256) is held in the service worker's memory and in `chrome.storage.session`, which is memory-only, is not readable by content scripts, and is cleared when the browser closes. Forgetting the passphrase means the encrypted data cannot be recovered.

Uninstalling the extension deletes all of it. You can also delete individual answers and applications in the side panel.

## What is sent, and where

| When | What | To |
| --- | --- | --- |
| You click Scan and fill | Values from your profile and answer bank are written into the form fields on that page | The page you are on, and the site when you submit |
| You have configured an LLM and a question is not matched confidently by rules | The question text and its visible options, plus the list of canonical question ids | The LLM endpoint you configured |
| You click "Draft from my profile" with an LLM configured | Your profile facts (summary, experience, education, skills), the job title, company and description from the page, and the question | The LLM endpoint you configured |
| You import a resume | Nothing. PDF and DOCX are parsed in the browser | n/a |
| You click Report a broken site | Nothing. A redacted file is saved to your downloads for you to inspect and share if you choose | n/a |

applyflow makes no other network requests. It loads no remote code. It does not send your profile, answers or history to the developer or to any third party.

If you use an LLM, its provider's privacy policy applies to what you send it. With a local model (Ollama, LM Studio) nothing leaves your machine.

## Diagnostics redaction

The broken-site report contains the form's HTML structure, field labels and how applyflow mapped them. Before saving, it removes every input value, textarea and rich-text content, selected options, scripts, images and non-structural attributes, strips URL query strings, and replaces any text matching your profile values, saved answers, email addresses, phone numbers or long digit sequences with placeholders. Open the file and read it before sharing it.

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save your data locally |
| `sidePanel` | The user interface |
| `scripting` | Inject the form-filling script into a tab when you click Scan and fill |
| Host access to Greenhouse, Lever, Ashby, Workable, LinkedIn and Naukri | Read and fill application forms on the supported sites |
| Optional host access (requested per site, only when you click "Allow on this site") | Fill forms on other career sites, and reach the LLM endpoint you configure |
