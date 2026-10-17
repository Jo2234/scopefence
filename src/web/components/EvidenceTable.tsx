import { useEffect, useState } from 'react';
import { applyEdit, formatMoney, priceOrder, type AnalysisItem, type ItemEdit, type Label, type PricedOrder, type RateCard } from '../../domain';

export const labels: Record<Label, string> = { included: 'Included', needs_clarification: 'Needs clarification', extra_work: 'Extra work' };
type Filter = Label | 'all' | 'unreviewed';
type Props = { items: AnalysisItem[]; card: RateCard; order: PricedOrder; selected: string | null;
  errors: Record<string, string>; notices: Record<string, string>; onSelect: (id: string) => void;
  onEdit: (id: string, edit: ItemEdit) => void; onApproveAll: () => void;
};
function DraftInput({ value, label, onChange, error }: { value: string; label: string; onChange: (value: string) => void; error?: string }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <><input aria-label={label} inputMode="decimal" value={draft} aria-invalid={!!error} onChange={e => { setDraft(e.target.value); onChange(e.target.value); }} />{error && <span className="field-error" role="alert">{error}</span>}</>;
}
export function EvidenceTable(p: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = p.items.filter(i => filter === 'all' || (filter === 'unreviewed' ? i.review === 'proposed' : i.label === filter));
  const filters: [Filter, string][] = [['all', 'All'], ['included', 'Included'], ['needs_clarification', 'Needs clarification'], ['extra_work', 'Extra work'], ['unreviewed', 'Unreviewed']];
  return <section className="panel evidence-panel" aria-labelledby="evidence-heading"><div className="section-heading"><h2 id="evidence-heading"><span className="step">2</span> Review the requests</h2><button type="button" className="small" disabled={!p.items.some(i => i.review === 'proposed')} onClick={p.onApproveAll}>Approve all remaining</button></div>
    <p className="muted small-text">Gemma proposes labels. Check the evidence, correct anything you disagree with, then approve or exclude each row.</p>
    <div className="filters" aria-label="Filter requests">{filters.map(([key, text]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{text} <span>{p.items.filter(i => key === 'all' || (key === 'unreviewed' ? i.review === 'proposed' : i.label === key)).length}</span></button>)}</div>
    <div className="scroll-table"><table className="evidence-table"><caption className="sr-only">Client requests and verified brief evidence</caption><thead><tr><th scope="col">#</th><th scope="col">Client asked</th><th scope="col">Label</th><th scope="col">Evidence</th><th scope="col">Reason / question</th><th scope="col">Hours or qty</th><th scope="col">Amount</th><th scope="col">Review</th></tr></thead><tbody>{visible.map(item => {
      const index = p.items.indexOf(item) + 1;
      const edit = (value: ItemEdit) => p.onEdit(item.id, value);
      // Proposed amounts are estimates from the same deterministic pricing function.
      const estimate = item.review === 'excluded' ? null : priceOrder([item.review === 'proposed' ? applyEdit(item, { review: 'approved' }, p.card) : item], p.card);
      const amount = estimate?.lines.find(l => l.item_id === item.id)?.amount_minor ?? 0;
      const pricingErrors = p.order.errors.filter(e => e.item_id === item.id);
      const prefix = `Row ${index}`;
      return <tr key={item.id} data-testid={`row-${item.id}`} data-label={item.label} data-review={item.review} className={`${p.selected === item.id ? 'selected-row' : ''} ${item.review === 'excluded' ? 'excluded-row' : ''}`} onClick={() => p.onSelect(item.id)} onFocus={() => p.onSelect(item.id)}>
        <th scope="row"><button type="button" className="row-selector" aria-label={`Select row ${index} evidence`} aria-pressed={p.selected === item.id} onClick={() => p.onSelect(item.id)}>{index}</button></th>
        <td><strong>{item.request}</strong><q className="message-quote">{item.message_quote}</q>{item.edited && <span className="muted small-text">Edited by you</span>}</td>
        <td><label className="sr-only" htmlFor={`${item.id}-label`}>{prefix} label</label><select id={`${item.id}-label`} className={`label-select ${item.label}`} value={item.label} onChange={e => edit({ label: e.target.value as Label })}>{Object.entries(labels).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
          {item.model_label !== item.label && <p className="muted small-text">Gemma: {labels[item.model_label]}</p>}
          {item.label === 'included' && <label className="small-text">Included as<select aria-label={`${prefix} included basis`} value={item.included_basis} onChange={e => edit({ included_basis: e.target.value as 'revision' | 'deliverable' })}><option value="deliverable">Agreed deliverable</option><option value="revision">Revision round</option></select></label>}
          {item.label === 'extra_work' && <label className="small-text">Price basis<select aria-label={`${prefix} price basis`} value={item.deliverable_id === 'none' ? 'custom' : item.deliverable_id} onChange={e => edit({ deliverable_id: e.target.value })}><option value="custom">Hourly / custom</option>{p.card.deliverables.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        </td>
        <td>{item.citation_status === 'verified' ? <><span className="clause-id">{item.clause_id ?? 'Brief'}</span><q>{item.brief_quote}</q><span className="verified small-text">✓ verified in your brief</span></> : item.citation_status === 'not_found' ? <><span className="field-error small-text">✗ Quoted clause not found in your brief</span><s><q>{item.brief_quote}</q></s></> : <span className="muted small-text">No brief clause cited</span>}<div className="reason-tags">{item.reason_codes.map(code => <span key={code}>{code.replaceAll('_', ' ')}</span>)}</div></td>
        <td><p>{item.reason}</p>{item.label === 'needs_clarification' ? <label className="small-text">Question<textarea rows={3} aria-label={`${prefix} question`} value={item.question} onChange={e => edit({ question: e.target.value })} /></label> : item.question && <p className="muted small-text">{item.question}</p>}</td>
        <td>{item.pricing.mode === 'hourly' ? <label className="small-text">Hours<DraftInput label={`${prefix} hours`} value={item.pricing.hours_hundredths === null ? '' : String(item.pricing.hours_hundredths / 100)} error={p.errors[`${item.id}.hours`]} onChange={hours => edit({ hours })} /></label> : item.pricing.mode === 'fixed' ? <label className="small-text">Quantity<DraftInput label={`${prefix} quantity`} value={String(item.pricing.quantity)} error={p.errors[`${item.id}.quantity`]} onChange={quantity => edit({ quantity: quantity.trim() ? Number(quantity) : NaN })} /></label> : <span className="muted">—</span>}{pricingErrors.map(e => <span key={e.code} className="field-error">{e.code.replaceAll('_', ' ')}</span>)}</td>
        <td className="amount">{item.review === 'excluded' ? 'Excluded' : formatMoney(amount, p.card.currency)}{item.review === 'proposed' && <span className="muted small-text">Proposed</span>}</td>
        <td>{item.review === 'excluded' ? <><span className="muted small-text">Excluded</span><button type="button" className="small" aria-label={`${prefix} Re-include`} onClick={() => edit({ review: 'proposed' })}>Re-include</button></> : <><button type="button" className={`small approve ${item.review === 'approved' ? 'approved' : ''}`} aria-pressed={item.review === 'approved'} aria-label={`${prefix} Approve`} onClick={() => edit({ review: item.review === 'approved' ? 'proposed' : 'approved' })}>{item.review === 'approved' ? '✓ Approved' : 'Approve'}</button><button type="button" className="small text-button" aria-label={`${prefix} Exclude`} onClick={() => edit({ review: 'excluded' })}>Exclude</button></>}{p.notices[item.id] && <p className="small-text override-note">{p.notices[item.id]}</p>}{Object.entries(p.errors).filter(([key]) => key.startsWith(`${item.id}.`) && !key.endsWith('.hours') && !key.endsWith('.quantity')).map(([key, error]) => <p className="field-error" key={key}>{error}</p>)}</td>
      </tr>;
    })}</tbody></table></div>
    {visible.length === 0 && <p className="empty-filter">No requests match this filter.</p>}
    <p className="muted small-text">Proposed amounts are estimates. Only approved rows contribute to the change-order total.</p>
  </section>;
}
