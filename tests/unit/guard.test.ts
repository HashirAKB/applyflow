import { describe, expect, it } from 'vitest';
import { checkGrounding, draftAnswer, profileFacts, templateDraft } from '../../src/core/guard';
import { emptyProfile, type Profile } from '../../src/core/types';
import { mockProvider } from '../../src/llm/mock';
import type { LlmProvider } from '../../src/llm/provider';

const profile: Profile = {
  ...emptyProfile(),
  firstName: 'Ada',
  lastName: 'Lovelace',
  summary: 'Backend engineer with 6 years of experience in TypeScript.',
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  experience: [{ company: 'Analytical Engines', title: 'Senior Engineer', start: '2021', end: 'Present', description: 'Led a team of 4 building APIs.' }],
  education: [{ school: 'University of London', degree: 'BSc', field: 'Mathematics', start: '2014', end: '2018' }],
};
const job = { company: 'Northwind', role: 'Backend Engineer', description: 'We use Node.js, PostgreSQL and Kafka. 3+ years required.' };
const P = profileFacts(profile).join('\n') + '\nAda Lovelace';
const J = `${job.company}\n${job.role}\n${job.description}`;

describe('truthfulness guard', () => {
  it('accepts text grounded in the profile and job description', () => {
    const text = 'I am a Backend engineer with 6 years of experience in TypeScript. At Analytical Engines I led a team of 4. Northwind uses Node.js and Kafka, which excites me.';
    expect(checkGrounding(text, P, J)).toEqual({ ok: true, problems: [] });
  });

  it('rejects invented numbers', () => {
    const r = checkGrounding('I have 10 years of experience and cut latency by 40%.', P, J);
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toMatch(/"10"/);
    expect(r.problems.join(' ')).toMatch(/"40"/);
  });

  it('rejects invented skills and technologies', () => {
    const r = checkGrounding('I am an expert in Rust and Go and have shipped Kubernetes operators.', P, J);
    expect(r.problems.join(' ')).toMatch(/Rust/);
    expect(r.problems.join(' ')).toMatch(/Kubernetes/);
  });

  it('rejects invented employers', () => {
    const r = checkGrounding('Previously I worked at Google on search.', P, J);
    expect(r.problems.join(' ')).toMatch(/Google/);
  });

  it('rejects invented credentials, even ones the job description mentions', () => {
    expect(checkGrounding('I hold a PhD in physics.', P, J).ok).toBe(false);
    expect(checkGrounding('I am AWS certified.', P, 'AWS certified engineers preferred').problems.join(' ')).toMatch(/certified/);
    expect(checkGrounding('I studied Mathematics for my BSc at University of London.', P, J).ok).toBe(true);
  });
});

describe('drafting', () => {
  it('template draft (no model) is grounded', async () => {
    const d = await draftAnswer('Cover letter', profile, job, null);
    expect(d.problems).toEqual([]);
    expect(d.text).toBe(templateDraft(profile, job));
    expect(d.text).toContain('Northwind');
    expect(d.text).toContain('Node.js, PostgreSQL');
  });

  it('mock model draft is grounded', async () => {
    const d = await draftAnswer('Why do you want to work here?', profile, job, mockProvider());
    expect(d.problems).toEqual([]);
    expect(d.text).toContain('Backend Engineer position at Northwind');
  });

  it('asks the user when the profile has nothing to draw from', async () => {
    let called = false;
    const spy: LlmProvider = { name: 'spy', complete: async () => ((called = true), 'text') };
    const d = await draftAnswer('Cover letter', emptyProfile(), job, spy);
    expect(d.text).toBe('');
    expect(d.problems[0]).toMatch(/write this answer yourself/);
    expect(called).toBe(false);
  });

  it('passes on the model saying grounding is insufficient', async () => {
    const llm: LlmProvider = { name: 'x', complete: async () => 'INSUFFICIENT_GROUNDING: no information about leadership' };
    const d = await draftAnswer('Describe your leadership style', profile, job, llm);
    expect(d.text).toBe('');
    expect(d.problems[0]).toMatch(/leadership/);
  });

  it('retries once with feedback, then discards a draft that keeps inventing', async () => {
    const prompts: string[] = [];
    const liar: LlmProvider = { name: 'liar', complete: async (r) => (prompts.push(r.prompt), 'I have 15 years at Google.') };
    const d = await draftAnswer('Cover letter', profile, job, liar);
    expect(d.text).toBe('');
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('UNGROUNDED CLAIMS');
    expect(d.problems.join(' ')).toMatch(/Google/);
  });

  it('accepts a corrected second attempt', async () => {
    let n = 0;
    const llm: LlmProvider = { name: 'x', complete: async () => (n++ === 0 ? 'I have 15 years of Rust.' : 'I have 6 years of experience in TypeScript.') };
    expect(await draftAnswer('Cover letter', profile, job, llm)).toEqual({ text: 'I have 6 years of experience in TypeScript.', problems: [] });
  });
});
