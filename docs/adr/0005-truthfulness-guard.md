# ADR 0005: Check generated text against its sources instead of trusting the prompt

Status: accepted (2026-11-04)

## Context
Cover letters and "why this company" answers are where an LLM is most tempted to invent experience, metrics or credentials, and an invented claim on an application can cost the user an offer.

## Decision
Generation receives only profile facts and the job description, and is told to answer `INSUFFICIENT_GROUNDING` if they are not enough. Every draft then passes `checkGrounding`: each number, each capitalised or tech-looking term and each credential word must appear in the profile or job description (credentials in the profile only). A failing draft is retried once with the list of problems; if it still fails, it is discarded and the user is told what was unsupported. Without an LLM, a template draft built only from profile fields is used.

## Alternatives
- Prompting alone: cheap, but unverifiable.
- An LLM judge: another model call that can itself be wrong or injected.

## Consequences
The guard is deterministic and unit-tested. It is deliberately strict, so it sometimes rejects acceptable prose (for example a proper noun the user mentions only in passing); the user can always edit or write the answer themselves.
