import { describe, expect, it } from 'vitest';
import { gate, pacingDelay, type GateInput } from '../../src/core/autosubmit';
import { defaultSettings } from '../../src/core/types';
import type { FieldDecision, FieldDescriptor } from '../../src/core/fields';

const field = (id: string, required = true): FieldDescriptor => ({ id, label: id, kind: 'text', options: [], required, name: '', hasValue: false });
const fill = (fieldId: string, confidence = 0.95): FieldDecision => ({ fieldId, questionId: 'x', value: 'v', confidence, method: 'rule', action: 'fill', reason: '' });

function ready(overrides: Partial<GateInput> = {}): GateInput {
  const settings = { ...defaultSettings().autoSubmit, enabled: true, riskAcknowledged: true, dryRun: false, sites: { lever: true } };
  return {
    settings,
    threshold: 0.75,
    site: 'lever',
    usedToday: 0,
    fields: [field('a'), field('b', false)],
    decisions: [fill('a'), { ...fill('b'), action: 'ask' }],
    blockers: [],
    hasSubmit: true,
    hasNext: false,
    nextMaySubmit: false,
    ...overrides,
  };
}

const reasons = (i: GateInput) => {
  const r = gate(i);
  return r.allowed ? [] : r.reasons;
};

describe('auto-submit gate', () => {
  it('is off by default', () => {
    const r = gate(ready({ settings: defaultSettings().autoSubmit }));
    expect(r.allowed).toBe(false);
    expect(reasons(ready({ settings: defaultSettings().autoSubmit }))).toEqual(
      expect.arrayContaining(['Auto-submit is off.', 'The risk confirmation has not been accepted.', 'Auto-submit is not enabled for lever.']),
    );
  });

  it('defaults to dry run, daily cap 10 and human-scale delays', () => {
    const s = defaultSettings().autoSubmit;
    expect(s).toMatchObject({ enabled: false, dryRun: true, dailyCap: 10, riskAcknowledged: false });
    expect(s.minDelayMs).toBeGreaterThanOrEqual(500);
  });

  it('submits when every rule passes (optional unanswered fields are fine)', () => {
    expect(gate(ready())).toEqual({ allowed: true, action: 'submit' });
  });

  it('dry run never submits', () => {
    expect(gate(ready({ settings: { ...ready().settings, dryRun: true } }))).toEqual({ allowed: true, action: 'dry-run' });
  });

  it('kill switch blocks everything', () => {
    expect(reasons(ready({ settings: { ...ready().settings, enabled: false } }))).toEqual(['Auto-submit is off.']);
  });

  it('requires the per-site opt-in and never runs on the generic adapter', () => {
    expect(reasons(ready({ site: 'greenhouse' }))).toEqual(['Auto-submit is not enabled for greenhouse.']);
    expect(reasons(ready({ site: 'generic', settings: { ...ready().settings, sites: { generic: true } } }))).toEqual([
      'Auto-submit only runs on sites with a dedicated adapter.',
    ]);
  });

  it('enforces the daily cap', () => {
    expect(reasons(ready({ usedToday: 10 }))).toEqual(['Daily limit reached (10 on lever).']);
    expect(gate(ready({ usedToday: 9 })).allowed).toBe(true);
  });

  it('stops on CAPTCHA and login prompts', () => {
    expect(reasons(ready({ blockers: ['captcha'] }))).toEqual(['A CAPTCHA is present. Complete it yourself.']);
    expect(reasons(ready({ blockers: ['login'] }))).toEqual(['A login prompt is present. Sign in yourself.']);
  });

  it('stops on unknown steps', () => {
    expect(reasons(ready({ fields: [], decisions: [], hasSubmit: false, hasNext: false }))).toHaveLength(2);
    expect(reasons(ready({ hasSubmit: false, hasNext: false }))).toEqual(['Unknown step: neither a next nor a submit button was found.']);
  });

  it('requires every required field filled at or above the threshold', () => {
    expect(reasons(ready({ decisions: [fill('a', 0.7)] }))).toEqual(['Required field not confidently filled: "a".']);
    expect(reasons(ready({ decisions: [{ ...fill('a'), action: 'ask' }] }))).toHaveLength(1);
    expect(reasons(ready({ decisions: [] }))).toHaveLength(1);
    expect(gate(ready({ decisions: [{ ...fill('a'), action: 'skip' }] })).allowed).toBe(true);
  });

  it('advances through intermediate steps and treats Naukri-style final saves as submit', () => {
    expect(gate(ready({ hasSubmit: false, hasNext: true }))).toEqual({ allowed: true, action: 'next' });
    const naukri = ready({ hasSubmit: false, hasNext: true, nextMaySubmit: true, settings: { ...ready().settings, dryRun: true } });
    expect(gate(naukri)).toEqual({ allowed: true, action: 'dry-run' });
  });

  it('pacing delay stays within the configured range', () => {
    const s = { ...defaultSettings().autoSubmit, minDelayMs: 1000, maxDelayMs: 3000 };
    expect(pacingDelay(s, () => 0)).toBe(1000);
    expect(pacingDelay(s, () => 0.999999)).toBe(3000);
    expect(pacingDelay({ ...s, minDelayMs: 5000, maxDelayMs: 1000 }, () => 0)).toBe(1000);
  });
});
