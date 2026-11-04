# ADR 0003: Rules, then fuzzy, then a constrained LLM, behind one confidence threshold

Status: accepted (2026-11-04)

## Context
The core problem is mapping thousands of wordings ("Expected CTC", "What are your salary expectations?", "How much would you like to earn?") onto a fixed set of questions, without ever filling a field with the wrong answer.

## Decision
A staged pipeline, cheapest and most precise first:
1. Memory: exact match against a label the user already answered (confidence 1.0).
2. Rules: hand-written regexes per canonical question, ordered so specific questions win (0.95).
3. Fuzzy: token Jaccard plus character trigram Dice against canonical labels, synonyms and remembered labels (score, capped at 0.90, reduced when two questions tie).
4. LLM (optional): classifies into the known id list only; output parsed as JSON and validated; self-reported confidence scaled by 0.85.

A field is filled only if confidence is at or above the user's threshold (default 0.75) and the stored value fits the field (a matching option, a single number for number inputs). Matches below 0.60 are treated as unknown so a new answer is never saved under a wrong guess.

## Alternatives
- LLM for everything: better recall, but slow, costs money, needs a key and fails closed without network.
- Embeddings: would need a model in the extension or a network call; the eval shows rules plus fuzzy already reach about 99% precision.

## Consequences
Works offline with no model. Precision is measurable and gated in CI (`npm run eval`, fails below 0.95). New wordings are learned from the user's own answers.
