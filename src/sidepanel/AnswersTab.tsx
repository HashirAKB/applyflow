import { useState } from 'react';
import { CATALOGUE, questionLabel } from '../core/canonical';
import { rememberAnswer } from '../core/answers';
import type { Answer } from '../core/types';
import type { State } from '../core/messages';
import { send } from './api';

/** Questions answered from the answer bank (not the profile, not generated). */
const BANK = CATALOGUE.filter((q) => q.source === 'answer');

export function AnswersTab({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const [answers, setAnswers] = useState<Answer[]>(state.answers ?? []);
  const [saved, setSaved] = useState(false);
  const byId = new Map(answers.map((a) => [a.questionId, a]));
  const extra = answers.filter((a) => !BANK.some((q) => q.id === a.questionId));

  function setValue(questionId: string, value: string) {
    setSaved(false);
    setAnswers(value ? rememberAnswer(answers, { questionId, label: '', value }) : answers.filter((a) => a.questionId !== questionId));
  }

  async function save() {
    onSaved(await send<State>({ type: 'save', key: 'answers', value: answers }));
    setSaved(true);
  }

  const row = (id: string, label: string, hint?: string) => (
    <label key={id}>
      {label}
      {hint && <span className="muted small"> {hint}</span>}
      <input value={byId.get(id)?.value ?? ''} onChange={(e) => setValue(id, e.target.value)} />
      {byId.get(id)?.aliases.length ? <span className="muted small">Seen as: {byId.get(id)!.aliases.slice(-3).join(' / ')}</span> : null}
    </label>
  );

  return (
    <div>
      <p className="small">
        Answers you give while filling are saved here automatically. EEO questions are optional: leave them empty to be asked each time, or save an answer such as
        "Decline to self-identify".
      </p>
      {BANK.map((q) => row(q.id, q.label, q.category === 'eeo' ? '(optional)' : undefined))}
      {extra.length > 0 && <h2>Learned from forms</h2>}
      {extra.map((a) => (
        <div key={a.questionId} className="row">
          {row(a.questionId, questionLabel(a.questionId))}
          <button onClick={() => setValue(a.questionId, '')} aria-label={`Delete ${questionLabel(a.questionId)}`}>
            Delete
          </button>
        </div>
      ))}
      <div className="sticky">
        <button className="primary wide" onClick={save}>
          {saved ? 'Saved' : 'Save answers'}
        </button>
      </div>
    </div>
  );
}
