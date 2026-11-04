import { useState } from 'react';
import type { LlmProviderName, Settings } from '../core/types';
import type { State } from '../core/messages';
import { ANTHROPIC_DEFAULT_MODEL } from '../llm/models';
import { send } from './api';
import { AutoSubmitSettings } from './AutoSubmitSettings';

const ENDPOINT: Record<LlmProviderName, (s: Settings) => string | null> = {
  none: () => null,
  mock: () => null,
  anthropic: () => 'https://api.anthropic.com',
  openai: (s) => {
    try {
      return new URL(s.llm.baseUrl).origin;
    } catch {
      return null;
    }
  },
};

export function SettingsTab({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const [s, setS] = useState<Settings>(state.settings);
  const [apiKey, setApiKey] = useState('');
  const [msg, setMsg] = useState('');
  const [pass, setPass] = useState('');

  async function save() {
    setMsg('');
    const origin = ENDPOINT[s.llm.provider](s);
    // Ask for access to exactly the endpoint the user chose, nothing broader.
    if (origin && !(await chrome.permissions.request({ origins: [`${origin}/*`] }))) {
      setMsg(`Permission for ${origin} was not granted, so the language model cannot be reached.`);
      return;
    }
    let next = await send<State>({ type: 'save', key: 'settings', value: s });
    if (apiKey) {
      next = await send<State>({ type: 'save', key: 'secrets', value: { llmApiKey: apiKey } });
      setApiKey('');
    }
    onSaved(next);
    setMsg('Saved.');
  }

  async function vault(action: 'enableEncryption' | 'disableEncryption' | 'lock') {
    setMsg('');
    try {
      const next = action === 'enableEncryption' ? await send<State>({ type: action, passphrase: pass }) : await send<State>({ type: action });
      setPass('');
      onSaved(next);
      setMsg(action === 'enableEncryption' ? 'Encryption is on.' : action === 'lock' ? 'Locked.' : 'Encryption is off.');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div>
      <h2>Matching</h2>
      <label>
        Fill automatically when at least {Math.round(s.threshold * 100)}% sure
        <input
          type="range"
          min={0.6}
          max={0.99}
          step={0.01}
          value={s.threshold}
          onChange={(e) => setS({ ...s, threshold: Number(e.target.value) })}
        />
      </label>

      <h2>Language model (optional)</h2>
      <p className="small">
        Without a model, applyflow uses rules and fuzzy matching. With one, it can understand unusual wordings and draft written answers from your profile. Only the
        question text (and, for drafts, your profile and the job description) is sent to the endpoint you choose.
      </p>
      <label>
        Provider
        <select value={s.llm.provider} onChange={(e) => setS({ ...s, llm: { ...s.llm, provider: e.target.value as LlmProviderName } })}>
          <option value="none">None (rules and fuzzy matching only)</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI-compatible (OpenAI, Groq, Ollama, LM Studio)</option>
          <option value="mock">Offline demo model</option>
        </select>
      </label>
      {s.llm.provider === 'openai' && (
        <label>
          Base URL
          <input value={s.llm.baseUrl} onChange={(e) => setS({ ...s, llm: { ...s.llm, baseUrl: e.target.value } })} placeholder="http://localhost:11434/v1" />
        </label>
      )}
      {(s.llm.provider === 'openai' || s.llm.provider === 'anthropic') && (
        <>
          <label>
            Model
            <input
              value={s.llm.model}
              onChange={(e) => setS({ ...s, llm: { ...s.llm, model: e.target.value } })}
              placeholder={s.llm.provider === 'anthropic' ? ANTHROPIC_DEFAULT_MODEL : 'gpt-4o-mini / llama3.1'}
            />
          </label>
          <label>
            API key {state.hasApiKey && <span className="muted small">(saved; type to replace)</span>}
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
          </label>
        </>
      )}
      <button className="primary" onClick={save}>
        Save settings
      </button>

      <AutoSubmitSettings state={state} onSaved={onSaved} />

      <h2>Encryption</h2>
      {state.vault === 'off' ? (
        <>
          <p className="small">Encrypt your profile, answers, applications, resume and API key with a passphrase (AES-GCM). If you forget it, the data cannot be recovered.</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase (8+ characters)" aria-label="New passphrase" />
          <button onClick={() => vault('enableEncryption')} disabled={pass.length < 8}>
            Turn on encryption
          </button>
        </>
      ) : (
        <div className="row">
          <button onClick={() => vault('lock')}>Lock now</button>
          <button onClick={() => vault('disableEncryption')}>Turn off encryption</button>
        </div>
      )}
      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
