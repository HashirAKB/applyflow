// Answer bank updates. Every answer the user gives is stored under its question id, and the exact
// label they saw is remembered as an alias so the same wording on another site matches instantly.

import { normalize } from './text';
import type { Answer } from './types';

export function customId(label: string): string {
  return `custom:${normalize(label).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'question'}`;
}

export function rememberAnswer(
  bank: Answer[],
  input: { questionId: string | null; label: string; value: string },
  now = new Date().toISOString(),
): Answer[] {
  const id = input.questionId ?? customId(input.label);
  const existing = bank.find((a) => a.questionId === id);
  const label = input.label.trim();
  const aliases = existing ? [...existing.aliases] : [];
  if (label && !aliases.some((a) => normalize(a) === normalize(label))) aliases.push(label);
  const next: Answer = { questionId: id, value: input.value, aliases: aliases.slice(-20), updatedAt: now };
  return existing ? bank.map((a) => (a.questionId === id ? next : a)) : [...bank, next];
}
