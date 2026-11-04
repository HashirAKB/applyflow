// Deterministic stand-in for an LLM, used by unit tests, e2e tests and the eval.
//
// It is honest about what it is: a concept lexicon (salary ~ pay ~ compensation ~ CTC, ...) that
// maps words to meanings, so it can bridge wordings that share no tokens, which is the kind of gap
// a real model closes. It reads the same prompt a real provider would receive and replies in the
// same JSON format, so it exercises the full parsing and confidence path. Eval numbers for
// "rules + mock LLM" measure the pipeline, not the accuracy of any real model.

import type { CompletionRequest, LlmProvider } from './provider';
import { stem } from '../core/text';

const CONCEPTS: Record<string, string[]> = {
  money: ['salary', 'ctc', 'compensation', 'pay', 'package', 'remuneration', 'wage', 'earning', 'income', 'lpa', 'stipend', 'base', 'rate', 'comp'],
  expect: ['expected', 'expect', 'desired', 'expectation', 'target', 'asking', 'looking', 'want', 'hope', 'require', 'requirement', 'ideal'],
  now: ['current', 'present', 'existing', 'drawn', 'presently', 'today', 'last'],
  notice: ['notice', 'serve', 'resign', 'resignation', 'release', 'relieve', 'relieving', 'buyout'],
  start: ['start', 'join', 'joining', 'available', 'availability', 'begin', 'commence', 'onboard', 'soon'],
  visa: ['sponsorship', 'sponsor', 'visa', 'h1b', 'h-1b', 'immigration', 'permit'],
  legal: ['authorized', 'authorised', 'eligible', 'legally', 'entitled', 'right', 'lawfully', 'citizen', 'citizenship', 'residency'],
  move: ['relocate', 'relocation', 'move', 'moving', 'shift'],
  travel: ['travel', 'trips', 'travelling', 'traveling'],
  office: ['remote', 'hybrid', 'onsite', 'office', 'in-person', 'commute', 'wfh'],
  years: ['years', 'year', 'yrs', 'yoe', 'tenure', 'long'],
  experience: ['experience', 'exp', 'worked', 'working', 'career'],
  education: ['education', 'degree', 'qualification', 'academic', 'diploma', 'bachelor', 'master', 'phd'],
  school: ['school', 'university', 'college', 'institute', 'institution', 'alma'],
  heard: ['hear', 'heard', 'learn', 'found', 'discover', 'source', 'came', 'posting'],
  refer: ['refer', 'referred', 'referral', 'referrer', 'recommended'],
  before: ['previously', 'before', 'former', 'ever', 'past', 'rehire', 'alumni', 'alumnus'],
  age: ['18', 'eighteen', 'age', 'adult', 'minor', 'older'],
  check: ['background', 'screening', 'verification', 'criminal', 'bgv'],
  gender: ['gender', 'sex', 'male', 'female'],
  ethnic: ['race', 'ethnicity', 'ethnic', 'heritage'],
  veteran: ['veteran', 'military', 'armed', 'service'],
  disability: ['disability', 'disabled', 'impairment', 'accommodation'],
  privacy: ['privacy', 'consent', 'gdpr', 'data', 'agree', 'acknowledge', 'terms', 'processing'],
  name: ['name'],
  first: ['first', 'given', 'forename'],
  last: ['last', 'surname', 'family'],
  mail: ['email', 'e-mail', 'mail'],
  phone: ['phone', 'mobile', 'cell', 'telephone', 'contact', 'whatsapp'],
  where: ['location', 'city', 'based', 'live', 'reside', 'residence', 'address', 'located', 'town'],
  country: ['country', 'nation', 'nationality'],
  link: ['linkedin', 'profile', 'url', 'link'],
  code: ['github', 'gitlab', 'repository', 'repo'],
  site: ['website', 'portfolio', 'blog', 'homepage', 'site'],
  employer: ['company', 'employer', 'organisation', 'organization', 'firm'],
  title: ['title', 'role', 'designation', 'position'],
  cv: ['resume', 'cv', 'curriculum'],
  letter: ['cover', 'letter', 'motivation'],
  why: ['why', 'interest', 'interested', 'excite', 'excites', 'attract', 'attracts', 'motivate', 'passion', 'appeal'],
  language: ['language', 'languages', 'speak', 'fluent', 'fluency', 'tongue'],
  clearance: ['clearance', 'classified', 'secret'],
  pronoun: ['pronoun', 'pronouns'],
  zip: ['zip', 'postal', 'postcode', 'pincode', 'pin'],
};

const WORD_TO_CONCEPT = new Map<string, string>();
for (const [concept, words] of Object.entries(CONCEPTS)) for (const w of words) WORD_TO_CONCEPT.set(stem(w), concept);

function concepts(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9-]+/)) {
    const c = WORD_TO_CONCEPT.get(stem(raw));
    if (c) out.add(c);
  }
  return out;
}

function classify(prompt: string): string {
  const question = prompt.match(/^QUESTION: (.*)$/m)?.[1] ?? '';
  const q = concepts(question);
  const cands = prompt.split('CANDIDATES:\n')[1]?.split('\n') ?? [];
  let best = 'none';
  let bestScore = 0;
  for (const line of cands) {
    const i = line.indexOf(': ');
    if (i < 0) continue;
    const c = concepts(line.slice(i + 2));
    if (!c.size || !q.size) continue;
    let inter = 0;
    for (const x of q) if (c.has(x)) inter++;
    // Dice overlap of meanings: a candidate must explain the question and not add unrelated meanings.
    const score = (2 * inter) / (q.size + c.size);
    if (score > bestScore) {
      bestScore = score;
      best = line.slice(0, i);
    }
  }
  if (bestScore < 0.6) return JSON.stringify({ id: 'none', confidence: 0.3 });
  return JSON.stringify({ id: best, confidence: bestScore });
}

/** For generation the mock echoes only lines from the prompt's FACTS section, so its output is grounded by construction. */
function generate(prompt: string): string {
  const facts = (prompt.split('FACTS:\n')[1] ?? '').split('\n\n')[0].split('\n').filter((l) => l.startsWith('- '));
  const company = prompt.match(/^COMPANY: (.*)$/m)?.[1] ?? 'your team';
  const role = prompt.match(/^ROLE: (.*)$/m)?.[1] ?? 'this role';
  const body = facts.slice(0, 4).map((f) => f.slice(2).replace(/\.$/, '')).join('. ');
  return `I am applying for the ${role} position at ${company}. ${body ? body + '.' : ''}`.trim();
}

export function mockProvider(): LlmProvider {
  return {
    name: 'mock',
    async complete(req: CompletionRequest) {
      return req.prompt.startsWith('QUESTION:') ? classify(req.prompt) : generate(req.prompt);
    },
  };
}
