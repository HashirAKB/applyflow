// A realistic test user. Values are fictional.
import type { Worker } from '@playwright/test';
import { swSend } from './harness';

export const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada.lovelace@example.com',
  phone: '+44 20 7946 0000',
  location: 'London, United Kingdom',
  city: 'London',
  country: 'United Kingdom',
  linkedin: 'https://www.linkedin.com/in/ada-example',
  github: 'https://github.com/ada-example',
  website: 'https://ada.example.com',
  summary: 'Backend engineer focused on TypeScript and distributed systems.',
  skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'React'],
  experience: [
    { company: 'Analytical Engines Ltd', title: 'Senior Software Engineer', start: '2021', end: 'Present', description: 'Led a team of 4 building TypeScript APIs on AWS.' },
    { company: 'Difference Systems', title: 'Software Engineer', start: '2018', end: '2021', description: 'Built Node.js services and PostgreSQL schemas.' },
  ],
  education: [{ school: 'University of London', degree: 'BSc', field: 'Mathematics', start: '2014', end: '2018' }],
};

export const ANSWERS = [
  { questionId: 'notice_period', value: '30 days', aliases: [], updatedAt: '' },
  { questionId: 'willing_to_relocate', value: 'Yes', aliases: [], updatedAt: '' },
  { questionId: 'work_authorization', value: 'Yes', aliases: [], updatedAt: '' },
  { questionId: 'requires_sponsorship', value: 'No', aliases: [], updatedAt: '' },
  { questionId: 'expected_ctc', value: '95000 GBP', aliases: [], updatedAt: '' },
  { questionId: 'how_heard', value: 'LinkedIn', aliases: [], updatedAt: '' },
];

export const RESUME = { name: 'ada-lovelace-cv.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4 test resume').toString('base64') };

export async function seed(sw: Worker, opts: { resume?: boolean } = {}) {
  await swSend(sw, { type: 'save', key: 'profile', value: PROFILE });
  await swSend(sw, { type: 'save', key: 'answers', value: ANSWERS });
  if (opts.resume !== false) await swSend(sw, { type: 'save', key: 'resume', value: RESUME });
}
