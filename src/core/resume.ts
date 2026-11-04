// Turn resume text into a draft profile. Heuristic and deliberately conservative: anything it is
// unsure about is left empty for the user to fill in on the review screen. Nothing is invented.

import { emptyProfile, type Education, type Experience, type Profile } from './types';

/** pdf.js text items -> lines, grouping items that share a baseline. */
export function pdfItemsToText(items: { str: string; transform: number[] }[]): string {
  const lines: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const [x, y] = [it.transform[4], it.transform[5]];
    let line = lines.find((l) => Math.abs(l.y - y) < 2);
    if (!line) lines.push((line = { y, parts: [] }));
    line.parts.push({ x, s: it.str });
  }
  return lines
    .sort((a, b) => b.y - a.y)
    .map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' ').replace(/\s+/g, ' ').trim())
    .join('\n');
}

const SECTION = /^(summary|profile|about( me)?|objective|(work |professional )?experience|employment( history)?|work history|education|academics?|(technical |core |key )?skills|technologies)$/i;
const DATE_RANGE = /((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(-|–|—|to)\s*(present|current|now|((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2})/i;
const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const URL_LIKE = /\b((https?:\/\/)?(www\.)?[\w-]+(\.[\w-]+)+(\/[\w./-]*)?)/gi;

function sectionKey(line: string): 'summary' | 'experience' | 'education' | 'skills' | null {
  const l = line.toLowerCase().replace(/[:\s]+$/, '');
  if (!SECTION.test(l)) return null;
  if (/summary|profile|about|objective/.test(l)) return 'summary';
  if (/experience|employment|work history/.test(l)) return 'experience';
  if (/education|academic/.test(l)) return 'education';
  return 'skills';
}

function withProtocol(u: string): string {
  return /^https?:\/\//.test(u) ? u : `https://${u}`;
}

function splitDates(text: string): { start: string; end: string } {
  const m = text.match(DATE_RANGE);
  if (!m) return { start: '', end: '' };
  const [start, end] = m[0].split(/\s*(?:-|–|—|\bto\b)\s*/i);
  return { start: start.trim(), end: end.trim() };
}

/** "Title, Company" | "Title at Company" | "Title | Company" | "Company - Title" (first form preferred). */
function splitHeader(header: string): { title: string; company: string } {
  const parts = header.split(/\s*(?:,|\bat\b|\||@| - | – )\s*/).filter(Boolean);
  if (parts.length < 2) return { title: header, company: '' };
  return { title: parts[0], company: parts.slice(1).join(', ') };
}

/** Group a section into entries: each entry is the header line(s) before a date range plus the lines after it. */
function entries(lines: string[]): { header: string; dates: string; body: string[] }[] {
  const out: { header: string; dates: string; body: string[] }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(DATE_RANGE);
    if (!m) {
      if (out.length) out[out.length - 1].body.push(line);
      continue;
    }
    const sameLine = line.replace(m[0], '').replace(/[|,()\s-]+$/, '').trim();
    let header = sameLine;
    if (!header && out.length && out[out.length - 1].body.length) header = out[out.length - 1].body.pop()!;
    else if (!header && !out.length && i > 0) header = lines[i - 1];
    out.push({ header, dates: m[0], body: [] });
  }
  return out;
}

export function parseResume(text: string): Profile {
  const p = emptyProfile();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const all = lines.join('\n');
  p.email = all.match(EMAIL)?.[0] ?? '';
  const phoneLine = lines.find((l) => PHONE.test(l.replace(EMAIL, '')) && !DATE_RANGE.test(l));
  p.phone = phoneLine?.replace(EMAIL, '').match(PHONE)?.[1].trim() ?? '';

  const urls = [...all.replace(EMAIL, ' ').matchAll(URL_LIKE)].map((m) => m[1]).filter((u) => /[a-z]/i.test(u) && !/^\d/.test(u));
  p.linkedin = withProtocol(urls.find((u) => /linkedin\.com/i.test(u)) ?? '').replace(/^https:\/\/$/, '');
  p.github = withProtocol(urls.find((u) => /github\.com/i.test(u)) ?? '').replace(/^https:\/\/$/, '');
  const site = urls.find((u) => !/linkedin\.com|github\.com/i.test(u) && /\.[a-z]{2,}(\/|$)/i.test(u) && !/\.(js|ts|net)$/i.test(u.split('/')[0]) && u.includes('.'));
  p.website = site && !/node\.js|react\.js|vue\.js/i.test(site) ? withProtocol(site) : '';

  // Name: the first short line made of capitalised words, before any section heading.
  const nameLine = lines.slice(0, 5).find((l) => /^[A-Z][\p{L}'.-]+(\s+[A-Z][\p{L}'.-]+){1,3}$/u.test(l) && !sectionKey(l));
  if (nameLine) {
    const parts = nameLine.split(' ');
    p.firstName = parts[0];
    p.lastName = parts.slice(1).join(' ');
  }

  // Location: a segment of the contact line that is not an email, phone or URL.
  const contact = lines.slice(0, 6).find((l) => EMAIL.test(l) || PHONE.test(l));
  if (contact) {
    const loc = contact
      .split(/\s*[|•·]\s*/)
      .find((s) => s && !EMAIL.test(s) && !PHONE.test(s) && !/\.(com|dev|io|in|org|net)\b/i.test(s) && /[A-Za-z]/.test(s) && s.length < 60);
    if (loc) {
      p.location = loc.trim();
      const bits = p.location.split(',').map((s) => s.trim());
      p.city = bits[0];
      p.country = bits.length > 1 ? bits[bits.length - 1] : '';
    }
  }

  // Sections.
  const sections: Record<string, string[]> = { summary: [], experience: [], education: [], skills: [] };
  let current: string | null = null;
  for (const l of lines) {
    const key = sectionKey(l);
    if (key) current = key;
    else if (current) sections[current].push(l);
  }

  p.summary = sections.summary.join(' ');
  p.skills = [...new Set(sections.skills.join(', ').split(/\s*[,;•|]\s*/).map((s) => s.trim()).filter((s) => s && s.length < 40))];
  p.experience = entries(sections.experience).map(({ header, dates, body }): Experience => {
    const { title, company } = splitHeader(header);
    return { title, company, ...splitDates(dates), description: body.join(' ') };
  });
  p.education = entries(sections.education).map(({ header, dates }): Education => {
    const parts = header.split(/\s*,\s*/);
    // "Degree, Field, School" or "Degree in Field, School" or "School, Degree"
    const schoolIdx = parts.findIndex((x) => /universit|college|institut|school|academy|iit|nit/i.test(x));
    const school = schoolIdx >= 0 ? parts[schoolIdx] : parts[parts.length - 1] ?? '';
    const rest = parts.filter((_, i) => i !== (schoolIdx >= 0 ? schoolIdx : parts.length - 1));
    const [degree = '', field = ''] = rest.length === 1 ? rest[0].split(/\s+in\s+/i) : rest;
    return { school, degree, field, ...splitDates(dates) };
  });
  return p;
}
