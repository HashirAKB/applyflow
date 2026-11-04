// Application tracker: one record per application URL, updated as the user fills and submits.
import type { ApplicationRecord, ApplicationStatus } from './types';

export const STATUSES: ApplicationStatus[] = ['filled', 'submitted', 'interviewing', 'offer', 'rejected', 'withdrawn'];

/** Same posting, different tracking params or fragment -> same record. */
export function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url;
  }
}

export interface RecordInput {
  url: string;
  site: string;
  company: string;
  role: string;
  jobDescription: string;
  answers: Record<string, string>;
}

export function recordApplication(list: ApplicationRecord[], input: RecordInput, now = new Date()): ApplicationRecord[] {
  const url = canonicalUrl(input.url);
  const existing = list.find((a) => a.url === url);
  if (existing) {
    const updated: ApplicationRecord = {
      ...existing,
      company: input.company || existing.company,
      role: input.role || existing.role,
      jobDescription: input.jobDescription || existing.jobDescription,
      answers: { ...existing.answers, ...input.answers },
    };
    return list.map((a) => (a.id === existing.id ? updated : a));
  }
  const record: ApplicationRecord = {
    id: `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    url,
    site: input.site,
    company: input.company,
    role: input.role,
    date: now.toISOString(),
    status: 'filled',
    answers: input.answers,
    jobDescription: input.jobDescription,
  };
  return [record, ...list];
}

export function setStatus(list: ApplicationRecord[], id: string, status: ApplicationStatus): ApplicationRecord[] {
  return list.map((a) => (a.id === id ? { ...a, status } : a));
}

/** RFC 4180 quoting, plus a guard against spreadsheet formula injection from page-controlled text. */
export function csvCell(value: string): string {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(list: ApplicationRecord[]): string {
  const header = ['date', 'company', 'role', 'status', 'site', 'url', 'answers', 'job_description'];
  const rows = list.map((a) => [
    a.date.slice(0, 10),
    a.company,
    a.role,
    a.status,
    a.site,
    a.url,
    Object.entries(a.answers)
      .map(([q, v]) => `${q}: ${v}`)
      .join('\n'),
    a.jobDescription,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
