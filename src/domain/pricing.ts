import type { AnalysisItem, PricedOrder, RateCard } from './schemas';
import { roundHalfUpDiv100 } from './money';
export function priceOrder(items: AnalysisItem[], rate_card: RateCard): PricedOrder {
  const order: PricedOrder = {
    currency: rate_card.currency, lines: [], covered: [], questions: [],
    revision: { included: rate_card.revision_rounds_included, used_before: rate_card.revision_rounds_used, used_by_this_message: 0, remaining_after: Math.max(0, rate_card.revision_rounds_included - rate_card.revision_rounds_used), beyond_allowance: false },
    subtotal_minor: 0, total_minor: 0, errors: [], unreviewed_count: items.filter(i => i.review === 'proposed').length, exportable: false,
  };
  function hourly(item: AnalysisItem, section: 'extra_work' | 'revision_beyond_allowance') {
    const h = item.pricing.hours_hundredths;
    if (h === null) { order.errors.push({ item_id: item.id, code: 'hours_required' }); return; }
    if (!Number.isInteger(h) || h < 1 || h > 50_000) { order.errors.push({ item_id: item.id, code: 'hours_invalid' }); return; }
    const product = h * rate_card.hourly_rate_minor;
    if (!Number.isSafeInteger(product)) throw new RangeError('Hourly amount exceeds safe integer range');
    order.lines.push({ item_id: item.id, section, description: item.request, mode: 'hourly', hours_hundredths: h, rate_minor: rate_card.hourly_rate_minor, quantity: null, unit_price_minor: null, amount_minor: roundHalfUpDiv100(product) });
  }
  function covered(item: AnalysisItem, revision_round: number | null) {
    order.covered.push({ item_id: item.id, description: item.request, brief_quote: item.brief_quote, clause_id: item.clause_id, basis: item.included_basis, revision_round, user_override: item.reason_codes.includes('user_override') });
  }
  for (const item of items) {
    if (item.review !== 'approved' || item.duplicate_of !== null) continue;
    if (item.label === 'included') {
      if (item.included_basis === 'revision') {
        order.revision.used_by_this_message = 1;
        if (rate_card.revision_rounds_used < rate_card.revision_rounds_included) covered(item, rate_card.revision_rounds_used + 1);
        else { order.revision.beyond_allowance = true; hourly(item, 'revision_beyond_allowance'); }
      } else covered(item, null);
    } else if (item.label === 'needs_clarification') {
      order.questions.push({ item_id: item.id, question: item.question || item.reason, message_quote: item.message_quote });
    } else if (item.pricing.mode === 'fixed') {
      const quantity = item.pricing.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) { order.errors.push({ item_id: item.id, code: 'quantity_invalid' }); continue; }
      const deliverable = rate_card.deliverables.find(d => d.id === item.deliverable_id);
      if (!deliverable) { order.errors.push({ item_id: item.id, code: 'unknown_deliverable' }); continue; }
      const amount = quantity * deliverable.price_minor;
      if (!Number.isSafeInteger(amount)) throw new RangeError('Fixed amount exceeds safe integer range');
      order.lines.push({ item_id: item.id, section: 'extra_work', description: item.request, mode: 'fixed', hours_hundredths: null, rate_minor: null, quantity, unit_price_minor: deliverable.price_minor, amount_minor: amount });
    } else hourly(item, 'extra_work');
  }
  order.revision.remaining_after = Math.max(0, order.revision.included - order.revision.used_before - order.revision.used_by_this_message);
  order.subtotal_minor = order.lines.reduce((sum, line) => sum + line.amount_minor, 0);
  if (!Number.isSafeInteger(order.subtotal_minor)) throw new RangeError('Order total exceeds safe integer range');
  order.total_minor = order.subtotal_minor;
  order.exportable = order.errors.length === 0 && order.unreviewed_count === 0;
  return order;
}
