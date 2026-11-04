import { describe, expect, it } from 'vitest';
import {
  decide,
  fuzzyMatch,
  matchField,
  memoryMatch,
  parseClassification,
  ruleMatch,
  type Match,
} from '../../src/core/matching';
import { yearsSkillId } from '../../src/core/canonical';
import type { FieldDescriptor } from '../../src/core/fields';
import { emptyProfile, type Answer } from '../../src/core/types';
import { mockProvider } from '../../src/llm/mock';
import type { LlmProvider } from '../../src/llm/provider';
import { similarity } from '../../src/core/fuzzy';

const answers: Answer[] = [
  { questionId: 'notice_period', value: '30 days', aliases: ['Notice period'], updatedAt: '' },
  { questionId: 'willing_to_relocate', value: 'Yes', aliases: [], updatedAt: '' },
  { questionId: 'custom:favourite-editor', value: 'Neovim', aliases: ['Which editor do you use daily?'], updatedAt: '' },
  { questionId: 'expected_ctc', value: '40 LPA', aliases: [], updatedAt: '' },
];
const profile = { ...emptyProfile(), firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', city: 'London', country: 'United Kingdom' };
const data = { profile, answers, hasResume: true, threshold: 0.75 };

function field(label: string, extra: Partial<FieldDescriptor> = {}): FieldDescriptor {
  return { id: 'f1', label, kind: 'text', options: [], required: true, name: '', hasValue: false, ...extra };
}

describe('rules', () => {
  it.each([
    ['First Name', 'first_name'],
    ['Expected CTC (LPA)', 'expected_ctc'],
    ['Current CTC', 'current_ctc'],
    ['I have read the candidate privacy notice', 'privacy_consent'],
    ['Will you now or in the future require sponsorship?', 'requires_sponsorship'],
    ['How many years of experience do you have with TypeScript?', 'years_skill:typescript'],
    ['Name of your referrer', 'referral'],
  ])('%s -> %s', (label, id) => {
    expect(ruleMatch(label)?.questionId).toBe(id);
  });

  it('falls back to the name attribute when the label is empty', () => {
    expect(ruleMatch('', 'job_application[email]')?.questionId).toBe('email');
  });

  it('extracts the skill from years-of-experience questions and ignores totals', () => {
    expect(yearsSkillId('years of react experience')).toBe('years_skill:react');
    expect(yearsSkillId('how many years have you worked with node.js')).toBe('years_skill:node.js');
    expect(yearsSkillId('years of experience in total')).toBeNull();
  });
});

describe('memory and fuzzy', () => {
  it('reuses a label the user answered before, including custom questions', () => {
    expect(memoryMatch('Which editor do you use daily?', answers)?.questionId).toBe('custom:favourite-editor');
  });

  it('scores near-identical labels high and unrelated ones low', () => {
    expect(similarity('Notice period', 'notice period')).toBe(1);
    expect(similarity('Expected salary', 'Expected salary per year')).toBeGreaterThan(0.6);
    expect(similarity('Expected salary', 'T-shirt size')).toBeLessThan(0.2);
    expect(fuzzyMatch('Which editor do you use every day?', answers).questionId).toBe('custom:favourite-editor');
  });
});

describe('LLM stage', () => {
  it('accepts only known ids and caps confidence', () => {
    const allowed = new Set(['notice_period']);
    expect(parseClassification('{"id":"notice_period","confidence":1}', allowed)).toEqual({ questionId: 'notice_period', confidence: 0.85, method: 'llm' });
    expect(parseClassification('{"id":"drop_tables","confidence":1}', allowed).questionId).toBeNull();
    expect(parseClassification('Sure! The answer is notice_period', allowed).questionId).toBeNull();
    expect(parseClassification('{"id":"notice_period","confidence":"high"}', allowed).questionId).toBeNull();
  });

  it('is only consulted when rules and fuzzy are not confident', async () => {
    let calls = 0;
    const spy: LlmProvider = { name: 'spy', complete: async () => (calls++, '{"id":"none","confidence":0}') };
    await matchField({ label: 'Email', name: '', options: [] }, { answers, threshold: 0.75, llm: spy });
    expect(calls).toBe(0);
    await matchField({ label: 'How much would you like to earn?', name: '', options: [] }, { answers, threshold: 0.75, llm: spy });
    expect(calls).toBe(1);
  });

  it('survives provider failures', async () => {
    const broken: LlmProvider = { name: 'broken', complete: async () => Promise.reject(new Error('offline')) };
    const m = await matchField({ label: 'How much would you like to earn?', name: '', options: [] }, { answers, threshold: 0.75, llm: broken });
    expect(m.method).not.toBe('llm');
  });

  it('mock provider bridges wordings with no shared tokens', async () => {
    const m = await matchField({ label: 'How much would you like to earn?', name: '', options: [] }, { answers, threshold: 0.75, llm: mockProvider() });
    expect(m.questionId).toBe('expected_ctc');
  });
});

describe('decide', () => {
  const rule = (id: string | null, confidence = 0.95): Match => ({ questionId: id, confidence, method: 'rule' });

  it('fills profile and answer bank values', () => {
    expect(decide(field('First name'), rule('first_name'), data)).toMatchObject({ action: 'fill', value: 'Ada' });
    expect(decide(field('Notice'), rule('notice_period'), data)).toMatchObject({ action: 'fill', value: '30 days' });
    expect(decide(field('Full name'), rule('full_name'), data)).toMatchObject({ value: 'Ada Lovelace' });
  });

  it('never fills below the threshold, but suggests the value', () => {
    expect(decide(field('x'), rule('notice_period', 0.6), data)).toMatchObject({ action: 'ask', value: '30 days' });
  });

  it('asks for unknown questions, missing answers and written answers', () => {
    expect(decide(field('Tell us a story'), rule(null, 0), data).action).toBe('ask');
    expect(decide(field('Current CTC'), rule('current_ctc'), data)).toMatchObject({ action: 'ask', reason: 'No saved answer yet' });
    expect(decide(field('Cover letter', { kind: 'textarea' }), rule('cover_letter'), data)).toMatchObject({ action: 'ask', reason: 'Needs a written answer' });
  });

  it('maps answers onto options and refuses when no option matches', () => {
    const relocate = field('Relocate?', { kind: 'radio', options: ['Yes, happy to', 'No'] });
    expect(decide(relocate, rule('willing_to_relocate'), data)).toMatchObject({ action: 'fill', value: 'Yes, happy to' });
    const country = field('Country', { kind: 'select', options: ['India', 'Germany'] });
    expect(decide(country, rule('country'), data)).toMatchObject({ action: 'ask', reason: 'Saved answer does not match any option' });
  });

  it('extracts a single number for number inputs', () => {
    expect(decide(field('Notice (days)', { kind: 'number' }), rule('notice_period'), data)).toMatchObject({ action: 'fill', value: '30' });
  });

  it('never overwrites a value already on the page', () => {
    expect(decide(field('Email', { hasValue: true }), rule('email'), data).action).toBe('skip');
  });

  it('only attaches the resume to resume upload fields', () => {
    expect(decide(field('Resume', { kind: 'file' }), rule('resume'), data)).toMatchObject({ action: 'fill', value: 'resume' });
    expect(decide(field('Resume', { kind: 'file' }), rule('resume'), { ...data, hasResume: false }).action).toBe('ask');
    expect(decide(field('Transcript', { kind: 'file' }), rule('school'), data).action).toBe('ask');
  });
});
