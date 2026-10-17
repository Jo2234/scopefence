import type { RateCard } from '../../domain';
import { RateCardForm } from './RateCardForm';

type Props = { brief: string; message: string; card: RateCard; formVersion: number; busy: boolean; valid: boolean;
  limits: { brief_chars: number; message_chars: number }; onText: (field: 'brief' | 'message', value: string) => void;
  onRate: (card: RateCard | null) => void; onDemo: (injection: boolean) => void; onAnalyse: () => void; onForget: () => void;
  storageNotice: string;
};
export function InputsPanel(p: Props) {
  return <section className="panel inputs" aria-labelledby="inputs-heading"><div className="section-heading"><h2 id="inputs-heading"><span className="step">1</span> The agreed scope</h2><span className="muted small-text">Private to this computer</span></div>
    <fieldset disabled={p.busy} className="input-fields">
      <div className="button-row demo-buttons"><button type="button" onClick={() => p.onDemo(false)}>Load synthetic demo</button><button type="button" onClick={() => p.onDemo(true)}>Load injection demo</button></div>
      <p className="muted small-text">Demos are invented examples, not real client projects.</p>
      {(['brief', 'message'] as const).map(field => {
        const limit = field === 'brief' ? p.limits.brief_chars : p.limits.message_chars;
        const label = field === 'brief' ? 'Brief' : 'Client message';
        return <div className="text-field" key={field}><label htmlFor={field}>{label}</label><textarea id={field} aria-label={label} value={p[field]} rows={field === 'brief' ? 9 : 6} placeholder={field === 'brief' ? 'Paste what you and the client agreed to deliver…' : 'Paste the client’s new request…'} aria-describedby={`${field}-counter`} onChange={e => p.onText(field, e.target.value)} /><p id={`${field}-counter`} className={`counter ${p[field].length > limit ? 'over-limit' : ''}`}>{p[field].length.toLocaleString('en')} / {limit.toLocaleString('en')} characters{p[field].length > limit && <span>Only the first {limit.toLocaleString('en')} characters will be analysed.</span>}</p></div>;
      })}
      <RateCardForm key={p.formVersion} card={p.card} onChange={p.onRate} />
      <button type="button" className="primary analyse" disabled={!p.valid} onClick={p.onAnalyse}>Analyse with local Gemma</button>
      {!p.valid && <p className="muted small-text">Enter a brief, a client message and a valid rate card to analyse.</p>}
      <button type="button" className="text-button" onClick={p.onForget}>Forget saved rate card</button>
      {p.storageNotice && <p className="small-text" role="status">{p.storageNotice}</p>}
    </fieldset>
  </section>;
}
