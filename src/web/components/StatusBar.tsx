import type { Analysis } from '../../domain';
import type { Health } from '../client';

export function ModelChip({ health }: { health: Health | null }) {
  const status = health?.model.status;
  const name = health?.model.id.includes('e2b') ? 'Gemma 4 E2B' : health?.model.id.includes('gemma-3-1b') ? 'Gemma 3 1B' : health?.model.id.includes('gemma-3-4b') ? 'Gemma 3 4B' : health?.model.id ?? 'Local model';
  return <span className={`model-chip ${status ?? 'checking'}`} role="status">{!health ? 'Checking local model…' : status === 'unreachable' ? 'Local model is not running' : health.mode === 'fixture' ? 'Recorded fixture · local · ready' : `${name} · ${health.model.runtime.split(' ')[0]} · local · ${status}`}</span>;
}
export function StatusBar({ health, analysis }: { health: Health | null; analysis: Analysis | null }) {
  const fixture = health?.mode === 'fixture' || analysis?.mode === 'fixture';
  return <><header className="topbar"><div><a href="#main" className="wordmark">Scope<span>Fence</span></a><p>Is this request in the brief? Checked by Gemma, running on this computer.</p></div><ModelChip health={health} /></header>
    {fixture && <div className="fixture-banner" role="status"><strong>FIXTURE MODE: replaying recorded output, not a live model call.</strong>{analysis?.model.provenance && <span>{analysis.model.provenance}</span>}</div>}
    {health?.mode === 'live' && (!health.model.is_gemma || !health.model.registered) && <div className="identity-warning">Warning: the loaded model is not a registered Gemma model. {!health.model.is_gemma && 'Gemma identity is not verified.'} {!health.model.registered && ' Model is not registered.'}</div>}
  </>;
}
