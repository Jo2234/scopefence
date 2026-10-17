import { useState } from 'react';
import { CurrencySchema, parseHours, parseMajorToMinor, RateCardSchema, type RateCard } from '../../domain';

type Draft = ReturnType<typeof draftFrom>;
function draftFrom(card: RateCard) {
  return { ...card, hourly_rate: (card.hourly_rate_minor / 100).toFixed(2),
    effort_hours: { xs: String(card.effort_hours.xs), s: String(card.effort_hours.s), m: String(card.effort_hours.m), l: String(card.effort_hours.l) },
    revision_rounds_included: String(card.revision_rounds_included), revision_rounds_used: String(card.revision_rounds_used),
    deliverables: card.deliverables.map(d => ({ ...d, price: (d.price_minor / 100).toFixed(2) })) };
}
function validate(draft: Draft): { card: RateCard | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  function amount(value: string, path: string) {
    try { return parseMajorToMinor(value); }
    catch { errors[path] = 'Must be a positive amount with at most 2 decimals.'; return NaN; }
  }
  const hourly_rate_minor = amount(draft.hourly_rate, 'hourly_rate_minor');
  const effort_hours = Object.fromEntries(Object.entries(draft.effort_hours).map(([key, value]) => {
    try { return [key, parseHours(value) / 100]; }
    catch { errors[`effort_hours.${key}`] = 'Hours must be greater than 0, at most 500, with at most 2 decimals.'; return [key, NaN]; }
  }));
  const result = RateCardSchema.safeParse({
    currency: draft.currency, hourly_rate_minor, effort_hours,
    deliverables: draft.deliverables.map((d, i) => ({ id: d.id, name: d.name, unit: d.unit, price_minor: amount(d.price, `deliverables.${i}.price_minor`) })),
    revision_rounds_included: draft.revision_rounds_included.trim() ? Number(draft.revision_rounds_included) : NaN,
    revision_rounds_used: draft.revision_rounds_used.trim() ? Number(draft.revision_rounds_used) : NaN,
    freelancer_name: draft.freelancer_name, client_name: draft.client_name, project_name: draft.project_name,
  });
  if (!result.success) for (const issue of result.error.issues) errors[issue.path.join('.')] ??= issue.message;
  if ('hourly_rate_minor' in errors) errors.hourly_rate_minor = 'Hourly rate must be a positive amount with at most 2 decimals.';
  return { card: result.success ? result.data : null, errors };
}
export function RateCardForm({ card, onChange }: { card: RateCard; onChange: (card: RateCard | null) => void }) {
  const [draft, setDraft] = useState(() => draftFrom(card));
  const [errors, setErrors] = useState<Record<string, string>>({});
  function change(next: Draft) {
    setDraft(next); const result = validate(next); setErrors(result.errors); onChange(result.card);
  }
  function error(path: string) { return errors[path] ? <span id={`rate-${path}-error`} className="field-error">{errors[path]}</span> : null; }
  function textField(label: string, key: 'freelancer_name' | 'client_name' | 'project_name' | 'revision_rounds_included' | 'revision_rounds_used', numeric = false) {
    return <label htmlFor={`rate-${key}`}>{label}<input id={`rate-${key}`} aria-label={label} value={draft[key]} inputMode={numeric ? 'numeric' : undefined} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `rate-${key}-error` : undefined} onChange={e => change({ ...draft, [key]: e.target.value })} />{error(key)}</label>;
  }
  return <details className="rate-card" open>
    <summary>Rate card <span className="muted">Your prices, calculated locally</span></summary>
    <div className="form-grid">
      <label>Currency<select value={draft.currency} onChange={e => change({ ...draft, currency: e.target.value as RateCard['currency'] })}>{CurrencySchema.options.map(c => <option key={c}>{c}</option>)}</select></label>
      <label htmlFor="rate-hourly-rate">Hourly rate<input id="rate-hourly-rate" aria-label="Hourly rate" inputMode="decimal" value={draft.hourly_rate} aria-invalid={!!errors.hourly_rate_minor} aria-describedby={errors.hourly_rate_minor ? 'rate-hourly_rate_minor-error' : undefined} onChange={e => change({ ...draft, hourly_rate: e.target.value })} />{error('hourly_rate_minor')}</label>
    </div>
    <fieldset><legend>Effort estimates · hours</legend><div className="effort-grid">{(['xs', 's', 'm', 'l'] as const).map(key => <label key={key}>{key.toUpperCase()}<input aria-label={`${key.toUpperCase()} effort hours`} inputMode="decimal" value={draft.effort_hours[key]} aria-invalid={!!errors[`effort_hours.${key}`]} onChange={e => change({ ...draft, effort_hours: { ...draft.effort_hours, [key]: e.target.value } })} />{error(`effort_hours.${key}`)}</label>)}</div></fieldset>
    <div className="section-heading"><h3>Deliverables</h3><button type="button" className="small" disabled={draft.deliverables.length >= 20} onClick={() => change({ ...draft, deliverables: [...draft.deliverables, { id: '', name: '', price: '', price_minor: 0, unit: '' }] })}>Add deliverable</button></div>
    <div className="scroll-table"><table className="rate-table"><caption className="sr-only">Deliverable prices</caption><thead><tr><th>ID</th><th>Name</th><th>Price</th><th>Unit</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{draft.deliverables.map((d, i) => <tr key={i}>{(['id', 'name', 'price', 'unit'] as const).map(key => <td key={key} data-label={key === 'id' ? 'ID' : key[0].toUpperCase() + key.slice(1)}><input aria-label={`Deliverable ${i + 1} ${key}`} value={d[key]} inputMode={key === 'price' ? 'decimal' : undefined} aria-invalid={!!errors[`deliverables.${i}.${key === 'price' ? 'price_minor' : key}`]} onChange={e => change({ ...draft, deliverables: draft.deliverables.map((row, n) => n === i ? { ...row, [key]: e.target.value } : row) })} />{error(`deliverables.${i}.${key === 'price' ? 'price_minor' : key}`)}</td>)}<td><button type="button" className="small" aria-label={`Remove deliverable ${i + 1}`} onClick={() => change({ ...draft, deliverables: draft.deliverables.filter((_, n) => n !== i) })}>Remove</button></td></tr>)}</tbody></table></div>
    {draft.deliverables.length === 0 && <p className="muted small-text">No fixed prices yet. Extra work can be priced by hours.</p>}{error('deliverables')}
    <div className="form-grid">{textField('Revision rounds included', 'revision_rounds_included', true)}{textField('Revision rounds used', 'revision_rounds_used', true)}{textField('Freelancer name', 'freelancer_name')}{textField('Client name', 'client_name')}{textField('Project name', 'project_name')}</div>
    <p className="muted small-text">Only the rate card is saved in this browser. Briefs and messages are not saved.</p>
  </details>;
}
