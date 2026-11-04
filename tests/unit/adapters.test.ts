// Adapter + detection + rules on fixtures captured from live public postings (and the Workable
// fixture built from its markup). Checks the questions a real applicant would see are understood.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickAdapter } from '../../src/content/adapters';
import { detectFields } from '../../src/content/detect';
import { ruleMatch } from '../../src/core/matching';

function load(fixture: string, url: string) {
  document.open();
  document.write(readFileSync(`tests/fixtures/${fixture}`, 'utf8'));
  document.close();
  const adapter = pickAdapter(new URL(url), document);
  const root = adapter.formRoot(document)!;
  const fields = detectFields(root, adapter).map((f) => ({ ...f.descriptor, q: ruleMatch(f.descriptor.label, f.descriptor.name)?.questionId ?? null }));
  return { adapter, root, fields, job: adapter.jobInfo(document) };
}

const CASES: [string, string, string, { company: string; role: RegExp }, [string, string | null, boolean?][]][] = [
  ['greenhouse-gitlab.html', 'https://job-boards.greenhouse.io/gitlab/jobs/8638232002', 'greenhouse', { company: 'GitLab', role: /AI Transformation Owner/ }, [
    ['First Name', 'first_name', true],
    ['Last Name', 'last_name', true],
    ['Email', 'email', true],
    ['Phone', 'phone'],
    ['Resume/CV', 'resume', true],
    ['Cover Letter', 'cover_letter'],
    ['LinkedIn Profile', 'linkedin'],
    ['Will you now or in the future require sponsorship', 'requires_sponsorship', true],
    ['Have you previously worked at or consulted for GitLab?', 'previously_employed', true],
    ['Are you subject to any employment agreements', null, true],
    ['Gender', 'gender'],
    ['Veteran Status', 'veteran_status'],
  ]],
  ['greenhouse-figma.html', 'https://job-boards.greenhouse.io/figma/jobs/5426468004', 'greenhouse', { company: 'Figma', role: /Account Executive/ }, [
    ['Location (City)', 'city', true],
    ['Why do you want to join Figma?', 'why_company', true],
    ['Preferred First Name', 'preferred_name'],
    ['Are you authorized to work', 'work_authorization', true],
    ['Additional Information', null],
  ]],
  ['lever-spotify.html', 'https://jobs.lever.co/spotify/2a55d6c9-c564-443a-be3e-a3851db5a93b/apply', 'lever', { company: 'Spotify', role: /Account Executive/ }, [
    ['Resume/CV', 'resume', true],
    ['Full name', 'full_name', true],
    ['Email', 'email', true],
    ['Current location', 'location', true],
    ['Current company', 'current_company', true],
    ['GitHub URL', 'github'],
    ['Portfolio URL', 'website'],
    ['Have you ever been previously employed by Spotify?', 'previously_employed', true],
  ]],
  ['lever-palantir.html', 'https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply', 'lever', { company: 'Palantir Technologies', role: /Administrative Business Partner/ }, [
    ['Full name', 'full_name', true],
    ['Language Skill(s)', 'languages', true],
    ['Name Pronunciation', null],
    ['Are you legally authorized to work', 'work_authorization', true],
    ['Which university are you currently attending', 'school', true],
    ['Please tell us how you heard about this opportunity.', 'how_heard', true],
    ['Why do you want to work at Palantir?', 'why_company', false],
  ]],
  ['ashby-ramp.html', 'https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application', 'ashby', { company: 'Ramp', role: /Security Engineer/ }, [
    ['Legal Name', 'full_name', true],
    ['Email', 'email', true],
    ['Resume', 'resume', true],
    ['LinkedIn Profile', 'linkedin', true],
    ['Do you have a minimum of 7 years of experience building software?', null, true],
    ['SMS', null],
  ]],
  ['ashby-linear.html', 'https://jobs.ashbyhq.com/linear/d3bc1ced-3ce4-4086-a050-555055dbb1ff/application', 'ashby', { company: 'Linear', role: /Fullstack Engineer/ }, [
    ['Name', 'full_name', true],
    ['Github', 'github', true],
    ['Notice Period', 'notice_period', true],
    ['What country are you based in?', 'country', true],
  ]],
  ['workable-synthetic.html', 'https://apply.workable.com/brightline/j/ABC123/apply/', 'workable', { company: 'Brightline Health', role: /Frontend Engineer/ }, [
    ['First name', 'first_name', true],
    ['What is your notice period?', 'notice_period', true],
    ['Expected annual salary (INR)', 'expected_ctc', true],
    ['Do you require visa sponsorship to work in India?', 'requires_sponsorship', true],
    ['How many years of experience do you have with React?', 'years_skill:react'],
    ['Tell us about an interface you are proud of', null],
  ]],
];

describe.each(CASES)('%s', (fixture, url, adapterId, job, expected) => {
  const { adapter, root, fields, job: info } = load(fixture, url);

  it('picks the adapter, finds the form, job info and submit button', () => {
    expect(adapter.id).toBe(adapterId);
    expect(root).toBeTruthy();
    expect(info.company).toBe(job.company);
    expect(info.role).toMatch(job.role);
    expect(adapter.submitButton(root)).toBeTruthy();
  });

  it.each(expected)('"%s" -> %s', (label, q, required) => {
    const f = fields.find((x) => x.label.startsWith(label));
    expect(f, `field "${label}" detected`).toBeTruthy();
    expect(f!.q).toBe(q);
    if (required !== undefined) expect(f!.required).toBe(required);
  });

  it('never exposes hidden duplicates, passwords or autofill dropzones', () => {
    expect(fields.every((f) => f.label.trim().length > 0)).toBe(true);
    const labels = fields.map((f) => `${f.kind}:${f.label}`);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('unverified adapters on synthetic fixtures', () => {
  it('LinkedIn Easy Apply: first step only, prefilled email skipped, next button found', () => {
    const { adapter, root, fields, job } = load('linkedin-easy-apply-synthetic.html', 'https://www.linkedin.com/jobs/view/123/');
    expect(adapter.id).toBe('linkedin');
    expect(adapter.verification).toBe('unverified');
    expect(job).toMatchObject({ company: 'Orbital Freight', role: 'Platform Engineer' });
    expect(fields.map((f) => [f.label, f.q, f.hasValue])).toEqual([
      ['First name', 'first_name', false],
      ['Last name', 'last_name', false],
      ['Email address', 'email', true],
      ['Mobile phone number', 'phone', false],
    ]);
    expect(adapter.nextButton(root)?.getAttribute('aria-label')).toBe('Continue to next step');
    expect(adapter.submitButton(root)).toBeNull();
  });

  it('Naukri: reads the current chatbot question and its text box', () => {
    const { adapter, root, fields, job } = load('naukri-synthetic.html', 'https://www.naukri.com/job-listings-senior-node-js-developer-123');
    expect(adapter.id).toBe('naukri');
    expect(job).toMatchObject({ company: 'Pinecrest Software', role: 'Senior Node.js Developer' });
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ label: 'What is your notice period?', kind: 'text', q: 'notice_period' });
    expect(adapter.nextMaySubmit).toBe(true);
    expect(adapter.nextButton(root)?.textContent).toBe('Save');
  });
});
