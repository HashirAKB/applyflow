import { useEffect, useState } from 'react';
import type { State } from '../core/messages';
import { send } from './api';

export function App() {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    send<State>({ type: 'getState' }).then(setState);
  }, []);
  return <main>{state ? <h1>applyflow</h1> : <p>Loading...</p>}</main>;
}
