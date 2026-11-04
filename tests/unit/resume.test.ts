// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseResume, pdfItemsToText } from '../../src/core/resume';

async function pdfText(path: string): Promise<string> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(path)), isEvalSupported: false, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(pdfItemsToText(content.items as { str: string; transform: number[] }[]));
  }
  return pages.join('\n');
}

function expectSample(p: ReturnType<typeof parseResume>) {
  expect(p.firstName).toBe('Priya');
  expect(p.lastName).toBe('Raman');
  expect(p.email).toBe('priya.raman@example.com');
  expect(p.phone).toBe('+91 98765 43210');
  expect(p.city).toBe('Bengaluru');
  expect(p.country).toBe('India');
  expect(p.linkedin).toBe('https://linkedin.com/in/priya-raman-example');
  expect(p.github).toBe('https://github.com/priya-example');
  expect(p.website).toBe('https://priya.example.dev');
  expect(p.summary).toMatch(/6 years of experience/);
  expect(p.skills).toEqual(['TypeScript', 'JavaScript', 'React', 'Node.js', 'PostgreSQL', 'AWS', 'Docker']);
  expect(p.experience).toEqual([
    {
      title: 'Senior Software Engineer',
      company: 'Flipside Commerce',
      start: 'Jan 2022',
      end: 'Present',
      description: 'Led the checkout rewrite in React and TypeScript, cutting page load time by 35%.',
    },
    { title: 'Software Engineer', company: 'Kite Analytics', start: 'Jul 2019', end: 'Dec 2021', description: 'Built Node.js APIs and PostgreSQL data pipelines.' },
  ]);
  expect(p.education).toEqual([
    { degree: 'B.Tech', field: 'Computer Science', school: 'National Institute of Technology Trichy', start: '2015', end: '2019' },
  ]);
}

describe('resume import', () => {
  it('parses a PDF resume', async () => {
    expectSample(parseResume(await pdfText('tests/fixtures/resume/sample-resume.pdf')));
  });

  it('parses a DOCX resume', async () => {
    const { value } = await mammoth.extractRawText({ buffer: readFileSync('tests/fixtures/resume/sample-resume.docx') });
    expectSample(parseResume(value));
  });

  it('leaves fields empty rather than guessing', () => {
    const p = parseResume('some text without structure\nanother line');
    expect(p.firstName).toBe('');
    expect(p.email).toBe('');
    expect(p.experience).toEqual([]);
  });
});
