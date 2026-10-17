import type { AnalysisItem, Basis, Label, RateCard, Review } from './schemas';
import { parseHours } from './money';
export type ItemEdit = { label: Label } | { included_basis: Basis } | { hours: string } | { quantity: number } | { deliverable_id: string } | { review: Review } | { question: string } | { request: string };
export class EditError extends Error {
  constructor(public readonly code: 'hours_invalid' | 'quantity_invalid' | 'unknown_deliverable' | 'invalid_input') {
    super(code); this.name = 'EditError';
  }
}
export function applyEdit(item: AnalysisItem, edit: ItemEdit, rate_card: RateCard): AnalysisItem {
  const next: AnalysisItem = { ...item, pricing: { ...item.pricing }, reason_codes: [...item.reason_codes], edited: true };
  if ('hours' in edit) {
    try { next.pricing.hours_hundredths = parseHours(edit.hours); }
    catch { throw new EditError('hours_invalid'); }
  } else if ('quantity' in edit) {
    if (!Number.isInteger(edit.quantity) || edit.quantity < 1 || edit.quantity > 999) throw new EditError('quantity_invalid');
    next.pricing.quantity = edit.quantity;
  } else if ('review' in edit) {
    // The UI must re-propose excluded rows before approving them; direct approval is invalid.
    if (item.review === 'excluded' && edit.review === 'approved') throw new EditError('invalid_input');
    next.review = edit.review;
    if (edit.review === 'proposed' && next.duplicate_of !== null) {
      // Re-proposing explicitly overrides a false dedupe so pricing can include the row.
      next.duplicate_of = null;
      next.reason_codes = next.reason_codes.filter(code => code !== 'duplicate');
    }
    // Keep injection_overlap and its annotations for display during manual review.
  } else if ('question' in edit) next.question = edit.question;
  else if ('request' in edit) next.request = edit.request;
  else {
    if ('label' in edit) {
      next.label = edit.label;
      if (edit.label === 'included' && next.citation_status !== 'verified' && !next.reason_codes.includes('user_override')) next.reason_codes.push('user_override');
    } else if ('included_basis' in edit) next.included_basis = edit.included_basis;
    else if ('deliverable_id' in edit) {
      if (!['custom', 'none'].includes(edit.deliverable_id) && !rate_card.deliverables.some(d => d.id === edit.deliverable_id)) throw new EditError('unknown_deliverable');
      next.deliverable_id = edit.deliverable_id;
    }
    // Re-run R9/R10, retaining edited hours/quantity even through a non-billable label.
    if (next.label !== 'included') next.included_basis = 'none';
    else if (next.included_basis === 'none') next.included_basis = 'deliverable';
    if (next.label === 'extra_work') {
      if (rate_card.deliverables.some(d => d.id === next.deliverable_id)) next.pricing.mode = 'fixed';
      else {
        if (!['custom', 'none'].includes(next.deliverable_id) && !next.reason_codes.includes('deliverable_unknown')) next.reason_codes.push('deliverable_unknown');
        next.deliverable_id = 'custom'; next.pricing.mode = 'hourly';
        if (next.pricing.hours_hundredths === null && next.effort !== 'none') next.pricing.hours_hundredths = Math.round(rate_card.effort_hours[next.effort] * 100);
        if (next.pricing.hours_hundredths === null && !next.reason_codes.includes('hours_required')) next.reason_codes.push('hours_required');
      }
    } else if (next.label === 'included' && next.included_basis === 'revision') {
      next.pricing.mode = 'hourly';
      if (next.pricing.hours_hundredths === null) next.pricing.hours_hundredths = Math.round(rate_card.effort_hours[next.effort === 'none' ? 's' : next.effort] * 100);
    } else next.pricing.mode = 'none';
  }
  return next;
}
