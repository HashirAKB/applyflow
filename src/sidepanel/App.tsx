import { useCallback, useEffect, useState } from 'react';
import type { State } from '../core/messages';
import { send } from './api';
import { FillTab } from './FillTab';
import { ProfileTab } from './ProfileTab';
import { AnswersTab } from './AnswersTab';
import { TrackerTab } from './TrackerTab';
import { SettingsTab } from './SettingsTab';

const TABS = ['Fill', 'Profile', 'Answers', 'Tracker', 'Settings'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>('Fill');
  const [error, setError] = useState('');

  const refresh = useCallback(() => send<State>({ type: 'getState' }).then(setState).catch((e: Error) => setError(e.message)), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!state) return <main className="pad">{error ? <p className="error">{error}</p> : <p>Loading...</p>}</main>;
  if (state.vault === 'locked') return <Unlock onUnlocked={setState} />;

  const isNew = !state.profile?.firstName && !state.profile?.email;
  return (
    <main>
      <header className="top">
        <h1>applyflow</h1>
        <nav role="tablist">
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
      </header>
      <section className="pad">
        {isNew && tab === 'Fill' ? (
          <div className="card onboarding">
            <h2>Welcome</h2>
            <p>Start by importing your resume. It is read on this computer and turned into a profile you can review.</p>
            <button className="primary" onClick={() => setTab('Profile')}>
              Set up my profile
            </button>
          </div>
        ) : null}
        {tab === 'Fill' && <FillTab state={state} onChange={refresh} />}
        {tab === 'Profile' && <ProfileTab state={state} onSaved={setState} />}
        {tab === 'Answers' && <AnswersTab state={state} onSaved={setState} />}
        {tab === 'Tracker' && <TrackerTab state={state} onSaved={setState} />}
        {tab === 'Settings' && <SettingsTab state={state} onSaved={setState} />}
      </section>
    </main>
  );
}

function Unlock({ onUnlocked }: { onUnlocked: (s: State) => void }) {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  return (
    <main className="pad">
      <h1>applyflow</h1>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          send<State>({ type: 'unlock', passphrase: pass }).then(onUnlocked, (err: Error) => setError(err.message));
        }}
      >
        <label>
          Passphrase
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
        </label>
        <button className="primary" type="submit">
          Unlock
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
