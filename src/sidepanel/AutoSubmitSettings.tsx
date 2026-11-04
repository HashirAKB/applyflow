import { useState } from 'react';
import type { AutoSubmitSettings as Auto } from '../core/types';
import type { State } from '../core/messages';
import { send } from './api';

const SITES: [string, string][] = [
  ['greenhouse', 'Greenhouse'],
  ['lever', 'Lever'],
  ['ashby', 'Ashby'],
  ['workable', 'Workable'],
  ['linkedin', 'LinkedIn Easy Apply (unverified)'],
  ['naukri', 'Naukri (unverified)'],
];

export function AutoSubmitSettings({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const [a, setA] = useState<Auto>(state.settings.autoSubmit);
  const [confirming, setConfirming] = useState(false);
  const [understood, setUnderstood] = useState(false);

  async function save(next: Auto) {
    setA(next);
    onSaved(await send<State>({ type: 'save', key: 'settings', value: { ...state.settings, autoSubmit: next } }));
  }

  async function stopAll() {
    const s = await send<State>({ type: 'killSwitch' });
    setA(s.settings.autoSubmit);
    onSaved(s);
  }

  return (
    <div>
      <h2>Auto-submit</h2>
      {a.enabled ? (
        <button className="danger wide" onClick={stopAll}>
          Stop all auto-submit
        </button>
      ) : !confirming ? (
        <>
          <p className="small">Off. applyflow fills forms; you review and click submit yourself.</p>
          <button onClick={() => (a.riskAcknowledged ? save({ ...a, enabled: true }) : setConfirming(true))}>Turn on auto-submit...</button>
        </>
      ) : (
        <div className="card danger" data-testid="risk-confirmation">
          <strong>Before you turn this on</strong>
          <ul className="small">
            <li>Some sites prohibit automated activity in their terms. LinkedIn's User Agreement, for example, forbids bots and automated methods for applying. Your account could be restricted or banned.</li>
            <li>The risk to your accounts is yours. applyflow does not hide that it is automating: it uses no stealth or anti-detection techniques.</li>
            <li>It submits only when every required field is filled with your own saved answers at or above your confidence threshold, never on a CAPTCHA, login or unknown step, and never more than the daily limit per site.</li>
            <li>Dry run is on by default: it does everything except click submit.</li>
          </ul>
          <label className="small">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} /> I understand and accept the risk
          </label>
          <button
            className="primary"
            disabled={!understood}
            onClick={() => {
              setConfirming(false);
              save({ ...a, enabled: true, riskAcknowledged: true });
            }}
          >
            Turn on auto-submit
          </button>
          <button onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      <label className="small">
        <input type="checkbox" checked={a.dryRun} onChange={(e) => save({ ...a, dryRun: e.target.checked })} /> Dry run (never click the final submit)
      </label>
      <div className="small">Allowed sites:</div>
      {SITES.map(([id, name]) => (
        <label key={id} className="small">
          <input type="checkbox" checked={!!a.sites[id]} onChange={(e) => save({ ...a, sites: { ...a.sites, [id]: e.target.checked } })} /> {name}
        </label>
      ))}
      <div className="grid">
        <label>
          Daily limit per site
          <input type="number" min={1} max={50} value={a.dailyCap} onChange={(e) => save({ ...a, dailyCap: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} />
        </label>
        <label>
          Pause between steps (seconds)
          <input
            type="number"
            min={0.5}
            max={30}
            step={0.5}
            value={a.minDelayMs / 1000}
            onChange={(e) => {
              const min = Math.max(500, Number(e.target.value) * 1000 || 500);
              save({ ...a, minDelayMs: min, maxDelayMs: Math.max(min, a.maxDelayMs) });
            }}
          />
        </label>
      </div>
    </div>
  );
}
