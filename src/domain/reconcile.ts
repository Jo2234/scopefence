import type { Analysis, AnalysisItem, Clause, Injection, ModelOutput, RateCard, ReasonCode } from './schemas';
import { clauseAt, findExact, normaliseForDedupe, overlapLen } from './quotes';
export type ReconcileContext = { brief_original: string; brief_analysed: string; message_analysed: string; clauses: Clause[]; rate_card: RateCard; injection: Injection };
export function reconcile(modelOutput: ModelOutput, ctx: ReconcileContext): { items: AnalysisItem[]; warnings: Analysis['warnings'] } {
  const warnings: Analysis['warnings'] = [];
  // R2. The schema also caps items; retain this guard for callers bypassing validation.
  if (modelOutput.items.length > 8) warnings.push({ code: 'items_capped', message: 'Only the first 8 requests were kept.' });
  const items: AnalysisItem[] = [];
  for (const [index, raw] of modelOutput.items.slice(0, 8).entries()) {
    const item: AnalysisItem = {
      id: `I${index + 1}`, request: raw.request, message_quote: raw.message_quote, message_span: null,
      model_label: raw.label, label: raw.label, reason: raw.reason, question: raw.question, reason_codes: [],
      model_clause_id: raw.clause_id === 'none' ? null : raw.clause_id, clause_id: null,
      brief_quote: raw.brief_quote, brief_span: null, citation_status: 'absent', included_basis: raw.included_basis,
      deliverable_id: raw.deliverable_id, effort: raw.effort, pricing: { mode: 'none', hours_hundredths: null, quantity: 1 },
      review: 'proposed', edited: false, duplicate_of: null, injection_overlap: false,
    };
    const annotate = (code: ReasonCode) => { if (!item.reason_codes.includes(code)) item.reason_codes.push(code); };
    // R3.
    item.message_span = findExact(ctx.message_analysed, item.message_quote);
    if (!item.message_span) {
      item.label = 'needs_clarification'; annotate('request_not_in_message');
      if (!item.question) item.question = 'Gemma paraphrased a request it could not quote from the message. Is this something the client asked for?';
    }
    // R4.
    if (item.brief_quote.trim().length > 0) {
      if (item.brief_quote.replace(/\s/g, '').length >= 8) item.brief_span = findExact(ctx.brief_original, item.brief_quote);
      item.citation_status = item.brief_span ? 'verified' : 'not_found';
    }
    // R5.
    if (item.label === 'included' && item.citation_status !== 'verified') {
      item.label = 'needs_clarification'; annotate(item.citation_status === 'absent' ? 'citation_missing' : 'citation_not_found');
    }
    // R6.
    if (item.brief_span) {
      item.clause_id = clauseAt(ctx.clauses, item.brief_span.start)?.id ?? null;
      if (item.clause_id !== item.model_clause_id) annotate('clause_id_corrected');
    }
    // R7.
    if (ctx.injection.suspected) {
      if (item.label === 'included') { item.label = 'needs_clarification'; annotate('injection_suspected'); }
      if (item.message_span && ctx.injection.spans.some(s => overlapLen(s, item.message_span!) > 0)) {
        item.injection_overlap = true; item.label = 'needs_clarification'; annotate('instruction_like_text'); item.review = 'excluded';
      }
    }
    // R8. Match the first earlier row, including rows excluded by R7/R8.
    const duplicate = items.find(earlier => normaliseForDedupe(earlier.message_quote) === normaliseForDedupe(item.message_quote)
      || (earlier.message_span && item.message_span && overlapLen(earlier.message_span, item.message_span) >= Math.min(earlier.message_span.end - earlier.message_span.start, item.message_span.end - item.message_span.start) / 2));
    if (duplicate) { item.duplicate_of = duplicate.id; annotate('duplicate'); item.review = 'excluded'; }
    // R9.
    if (item.label !== 'included') item.included_basis = 'none';
    else if (item.included_basis === 'none') item.included_basis = 'deliverable';
    // R10.
    if (item.label === 'extra_work') {
      if (ctx.rate_card.deliverables.some(d => d.id === item.deliverable_id)) item.pricing.mode = 'fixed';
      else {
        if (!['custom', 'none'].includes(item.deliverable_id)) annotate('deliverable_unknown');
        item.deliverable_id = 'custom'; item.pricing.mode = 'hourly';
        item.pricing.hours_hundredths = item.effort === 'none' ? null : Math.round(ctx.rate_card.effort_hours[item.effort] * 100);
        if (item.pricing.hours_hundredths === null) annotate('hours_required');
      }
    } else if (item.label === 'included' && item.included_basis === 'revision') {
      item.pricing.mode = 'hourly';
      item.pricing.hours_hundredths = Math.round(ctx.rate_card.effort_hours[item.effort === 'none' ? 's' : item.effort] * 100);
    }
    // R11: starts proposed; only R7/R8 can exclude it.
    items.push(item);
  }
  // R12.
  if (!items.length && ctx.message_analysed.length) warnings.push({ code: 'no_items_found', message: 'Gemma found no change requests in this message. Read it yourself before replying.' });
  return { items, warnings };
}
