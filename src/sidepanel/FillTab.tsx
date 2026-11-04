import { useState } from 'react';
import type { FieldDecision, FieldDescriptor } from '../core/fields';
import type { State } from '../core/messages';
import { questionLabel } from '../core/canonical';
import type { FillReport } from '../background/fill';
import { send } from './api';

export async function currentTabId(): Promise<number> {
  const fromUrl = new URLSearchParams(location.search).get('tabId');
  if (fromUrl) return Number(fromUrl);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('No active tab.');
  return tab.id;
}

const BLOCKER_TEXT: Record<string, string> = {
  captcha: 'This page has a CAPTCHA. applyflow never touches it: complete it yourself before submitting.',
  login: 'This page asks for a password. applyflow never handles logins: sign in yourself, then scan again.',
};

export function FillTab({ state, onChange }: { state: State; onChange: () => void }) {
  const [report, setReport] = useState<FillReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsOrigin, setNeedsOrigin] = useState('');

  async function scan(type: 'fillTab' | 'nextStep' = 'fillTab') {
    setBusy(true);
    setError('');
    setNeedsOrigin('');
    try {
      setReport(await send<FillReport>({ type, tabId: await currentTabId() }));
      onChange();
    } catch (e) {
      const msg = (e as Error).message;
      const origin = msg.match(/needs permission to read forms on (\S+)/)?.[1];
      if (origin) setNeedsOrigin(origin);
      else setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function allow() {
    // Must run inside the click handler: Chrome only shows the permission prompt for a user gesture.
    const granted = await chrome.permissions.request({ origins: [`${needsOrigin}/*`] });
    if (granted) await scan();
  }

  const fieldById = new Map(report?.scan.fields.map((f) => [f.id, f]));
  const ask = report?.decisions.filter((d) => d.action === 'ask') ?? [];
  const filled = report?.decisions.filter((d) => d.action === 'fill') ?? [];
  const skipped = report?.decisions.filter((d) => d.action === 'skip') ?? [];
  // Required questions first.
  ask.sort((a, b) => Number(fieldById.get(b.fieldId)?.required) - Number(fieldById.get(a.fieldId)?.required));

  return (
    <div>
      <button className="primary wide" onClick={() => scan()} disabled={busy}>
        {busy ? 'Reading the form...' : report ? 'Scan again' : 'Scan and fill this page'}
      </button>
      <p className="hint">Fields are filled only when applyflow is at least {Math.round(state.settings.threshold * 100)}% sure. Everything else is listed here for you.</p>
      {needsOrigin && (
        <div className="card warn">
          <p>applyflow needs your permission to read forms on {needsOrigin}.</p>
          <button className="primary" onClick={allow}>
            Allow on this site
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {report && (
        <>
          <div className="card">
            <strong>{report.scan.job.role || 'Untitled role'}</strong>
            {report.scan.job.company && <span> at {report.scan.job.company}</span>}
            <div className="muted">
              {report.scan.siteName} | {filled.length} filled, {ask.length} need you, {skipped.length} already filled
            </div>
            {report.scan.verification === 'unverified' && (
              <div className="small warn-text">This site adapter is unverified: built from documented page structure, not yet confirmed on the live site. Check every field.</div>
            )}
          </div>
          {report.scan.blockers.map((b) => (
            <p key={b} className="card warn">
              {BLOCKER_TEXT[b] ?? b}
            </p>
          ))}
          {report.scan.fields.length === 0 && <p className="card warn">No form fields found. If this is a multi-step form, open the step with questions and scan again.</p>}
          {ask.length > 0 && <h2>Needs you ({ask.length})</h2>}
          {ask.map((d) => (
            <AskField key={d.fieldId} decision={d} field={fieldById.get(d.fieldId)!} onDone={() => scan()} />
          ))}
          {report.scan.hasNext && (
            <button className="wide" onClick={() => scan('nextStep')} disabled={busy || ask.some((d) => fieldById.get(d.fieldId)?.required)}>
              {report.scan.nextMaySubmit ? 'Save answer and continue (the last one completes the application)' : 'Next step and fill'}
            </button>
          )}
          {filled.length > 0 && <h2>Filled ({filled.length})</h2>}
          <ul className="filled">
            {filled.map((d) => (
              <li key={d.fieldId}>
                <span className={d.confidence >= 0.9 ? 'conf high' : 'conf mid'}>{Math.round(d.confidence * 100)}%</span>
                <span className="label">{fieldById.get(d.fieldId)?.label}</span>
                <span className="muted">{d.value === 'resume' ? state.resumeName : d.value}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function AskField({ decision, field, onDone }: { decision: FieldDecision; field: FieldDescriptor; onDone: () => void }) {
  const [value, setValue] = useState(decision.value ?? '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [drafting, setDrafting] = useState(false);
  const isWritten = decision.reason === 'Needs a written answer' || field.kind === 'textarea';

  async function fill() {
    setError('');
    try {
      const tabId = await currentTabId();
      const ok = await send<boolean>({ type: 'answerField', tabId, field, questionId: decision.questionId, value, remember });
      if (!ok) setError('That value could not be applied to this field.');
      else onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function draft() {
    setDrafting(true);
    setError('');
    try {
      const res = await send<{ text: string; problems: string[] }>({ type: 'generate', tabId: await currentTabId(), field });
      setValue(res.text);
      if (res.problems.length) setError(res.problems.join(' '));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <div className="card ask" data-testid="ask-field">
      <div className="label">
        {field.label || '(no label)'} {field.required && <span className="req">required</span>}
      </div>
      <div className="muted small">
        {decision.reason}
        {decision.questionId && ` | looks like: ${questionLabel(decision.questionId)} (${Math.round(decision.confidence * 100)}%)`}
      </div>
      {field.kind === 'file' ? (
        <p className="small">Attach this file yourself on the page.</p>
      ) : (
        <>
          {field.options.length > 0 && field.kind !== 'checkbox' ? (
            <select value={value} onChange={(e) => setValue(e.target.value)} aria-label={field.label}>
              <option value="">Choose...</option>
              {field.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : isWritten ? (
            <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} aria-label={field.label} />
          ) : (
            <input value={value} onChange={(e) => setValue(e.target.value)} aria-label={field.label} />
          )}
          <div className="row">
            <label className="small">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember for next time
            </label>
            {isWritten && (
              <button onClick={draft} disabled={drafting}>
                {drafting ? 'Drafting...' : 'Draft from my profile'}
              </button>
            )}
            <button className="primary" onClick={fill} disabled={!value}>
              Fill
            </button>
          </div>
        </>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
