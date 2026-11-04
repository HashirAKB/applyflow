import { describe, expect, it } from 'vitest';
import { canonicalUrl, csvCell, recordApplication, setStatus, toCsv } from '../../src/core/tracker';

const input = {
  url: 'https://jobs.lever.co/acme/123/apply?lever-source=LinkedIn#top',
  site: 'lever',
  company: 'Acme',
  role: 'Engineer',
  jobDescription: 'Build things.',
  answers: { Email: 'ada@example.com' },
};

describe('tracker', () => {
  it('creates one record per posting and merges later answers', () => {
    let list = recordApplication([], input, new Date('2026-11-01T10:00:00Z'));
    list = recordApplication(list, { ...input, url: 'https://jobs.lever.co/acme/123/apply/', answers: { Phone: '123' } });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ url: 'https://jobs.lever.co/acme/123/apply', status: 'filled', date: '2026-11-01T10:00:00.000Z' });
    expect(list[0].answers).toEqual({ Email: 'ada@example.com', Phone: '123' });
  });

  it('updates status', () => {
    const list = recordApplication([], input);
    expect(setStatus(list, list[0].id, 'interviewing')[0].status).toBe('interviewing');
  });

  it('normalises URLs', () => {
    expect(canonicalUrl('https://a.com/x/?y=1#z')).toBe('https://a.com/x');
  });

  it('escapes CSV and neutralises formula injection', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('-1+2')).toBe("'-1+2");
    const csv = toCsv(recordApplication([], { ...input, company: 'Acme, Inc.' }, new Date('2026-11-01T00:00:00Z')));
    const [head, row] = csv.split('\r\n');
    expect(head).toBe('date,company,role,status,site,url,answers,job_description');
    expect(row.startsWith('2026-11-01,"Acme, Inc.",Engineer,filled,lever,https://jobs.lever.co/acme/123/apply,Email: ada@example.com,Build things.')).toBe(true);
  });
});
