import type { ApplicationStatus } from '../core/types';
import type { State } from '../core/messages';
import { setStatus, STATUSES, toCsv } from '../core/tracker';
import { send } from './api';

export function TrackerTab({ state, onSaved }: { state: State; onSaved: (s: State) => void }) {
  const list = state.applications ?? [];

  const save = async (next: typeof list) => onSaved(await send<State>({ type: 'save', key: 'applications', value: next }));

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(list)], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `applyflow-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!list.length) return <p className="small">No applications yet. Every form you fill is logged here.</p>;
  return (
    <div>
      <div className="row">
        <span className="muted small">{list.length} applications</span>
        <button onClick={exportCsv}>Export CSV</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Date</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id} data-testid="application-row">
              <td>
                <a href={a.url} target="_blank" rel="noreferrer">
                  {a.role || a.url}
                </a>
                <div className="muted">
                  {a.company} | {a.site} | {Object.keys(a.answers).length} answers
                </div>
              </td>
              <td>{a.date.slice(0, 10)}</td>
              <td>
                <select value={a.status} aria-label={`Status for ${a.role}`} onChange={(e) => save(setStatus(list, a.id, e.target.value as ApplicationStatus))}>
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td>
                <button onClick={() => save(list.filter((x) => x.id !== a.id))} aria-label={`Delete ${a.role}`}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
