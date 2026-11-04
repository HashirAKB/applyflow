import { useState } from 'react';
import { parseResume } from '../core/resume';
import { emptyProfile, type Education, type Experience, type Profile } from '../core/types';
import type { State } from '../core/messages';
import { send } from './api';
import { resumeText, toResumeFile } from './resumeImport';

const CONTACT: [keyof Profile, string][] = [
  ['firstName', 'First name'],
  ['lastName', 'Last name'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['location', 'Location'],
  ['city', 'City'],
  ['country', 'Country'],
  ['linkedin', 'LinkedIn URL'],
  ['github', 'GitHub URL'],
  ['website', 'Website / portfolio'],
];

export function ProfileTab({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const [p, setP] = useState<Profile>(state.profile ?? emptyProfile());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });

  async function importResume(file: File) {
    setError('');
    setStatus('Reading your resume on this computer...');
    try {
      const parsed = parseResume(await resumeText(file));
      // Keep anything the user already typed; only fill empty fields from the resume.
      const merged = { ...parsed } as Profile;
      for (const k of Object.keys(p) as (keyof Profile)[]) {
        const cur = p[k];
        if (Array.isArray(cur) ? cur.length : cur) (merged as unknown as Record<string, unknown>)[k] = cur;
      }
      setP(merged);
      onSaved(await send<State>({ type: 'save', key: 'resume', value: await toResumeFile(file) }));
      setStatus('Imported. Review every field below, fix anything wrong, then save.');
    } catch (e) {
      setStatus('');
      setError((e as Error).message);
    }
  }

  async function save() {
    onSaved(await send<State>({ type: 'save', key: 'profile', value: p }));
    setStatus('Saved.');
  }

  const updateList = <T,>(list: T[], i: number, patch: Partial<T>) => list.map((x, j) => (j === i ? { ...x, ...patch } : x));

  return (
    <div>
      <div className="card">
        <h2>Import resume</h2>
        <p className="small">PDF or DOCX. Parsed locally; the file is kept so applyflow can attach it to applications.</p>
        <input type="file" accept=".pdf,.docx" aria-label="Resume file" onChange={(e) => e.target.files?.[0] && importResume(e.target.files[0])} />
        {state.resumeName && <p className="small muted">Saved resume: {state.resumeName}</p>}
        {status && <p className="small">{status}</p>}
        {error && <p className="error small">{error}</p>}
      </div>

      <h2>Contact and links</h2>
      <div className="grid">
        {CONTACT.map(([k, label]) => (
          <label key={k}>
            {label}
            <input value={p[k] as string} onChange={(e) => set(k, e.target.value as never)} />
          </label>
        ))}
      </div>
      <label>
        Summary
        <textarea rows={3} value={p.summary} onChange={(e) => set('summary', e.target.value)} />
      </label>
      <label>
        Skills (comma separated)
        <input value={p.skills.join(', ')} onChange={(e) => set('skills', e.target.value.split(/\s*,\s*/).filter(Boolean))} />
      </label>

      <h2>Experience</h2>
      {p.experience.map((x, i) => (
        <div className="card" key={i}>
          <div className="grid">
            {(['title', 'company', 'start', 'end'] as (keyof Experience)[]).map((k) => (
              <label key={k}>
                {k}
                <input value={x[k]} onChange={(e) => set('experience', updateList(p.experience, i, { [k]: e.target.value }))} />
              </label>
            ))}
          </div>
          <label>
            description
            <textarea rows={2} value={x.description} onChange={(e) => set('experience', updateList(p.experience, i, { description: e.target.value }))} />
          </label>
          <button onClick={() => set('experience', p.experience.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button onClick={() => set('experience', [...p.experience, { title: '', company: '', start: '', end: '', description: '' }])}>Add experience</button>

      <h2>Education</h2>
      {p.education.map((x, i) => (
        <div className="card" key={i}>
          <div className="grid">
            {(['school', 'degree', 'field', 'start', 'end'] as (keyof Education)[]).map((k) => (
              <label key={k}>
                {k}
                <input value={x[k]} onChange={(e) => set('education', updateList(p.education, i, { [k]: e.target.value }))} />
              </label>
            ))}
          </div>
          <button onClick={() => set('education', p.education.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button onClick={() => set('education', [...p.education, { school: '', degree: '', field: '', start: '', end: '' }])}>Add education</button>

      <div className="sticky">
        <button className="primary wide" onClick={save}>
          Save profile
        </button>
      </div>
    </div>
  );
}
