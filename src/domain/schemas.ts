import { z } from 'zod';

export const LabelSchema = z.enum(['included', 'needs_clarification', 'extra_work']);
export const BasisSchema = z.enum(['deliverable', 'revision', 'none']);
export const EffortSchema = z.enum(['xs', 's', 'm', 'l', 'none']);
export const CitationStatusSchema = z.enum(['verified', 'not_found', 'absent']);
export const ReviewSchema = z.enum(['proposed', 'approved', 'excluded']);
export const CurrencySchema = z.enum(['SGD', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'INR', 'MYR', 'PHP']);
export const ReasonCodeSchema = z.enum(['citation_not_found', 'citation_missing', 'request_not_in_message', 'injection_suspected', 'instruction_like_text', 'duplicate', 'clause_id_corrected', 'deliverable_unknown', 'hours_required', 'user_override', 'truncated_input']);
export const ErrorCodeSchema = z.enum(['invalid_input', 'model_unreachable', 'model_busy', 'model_timeout', 'model_output_invalid', 'fixture_missing', 'cancelled', 'internal']);
export type Label = z.infer<typeof LabelSchema>;
export type Basis = z.infer<typeof BasisSchema>;
export type Effort = z.infer<typeof EffortSchema>;
export type CitationStatus = z.infer<typeof CitationStatusSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

const nonnegativeInt = z.number().int().nonnegative().safe();
const positiveMinor = z.number().int().min(1).max(100_000_000);
export const HoursSchema = z.number().positive().max(500).refine(h => Math.abs(h * 100 - Math.round(h * 100)) < 1e-8, 'Hours must have at most two decimals');
export type Hours = z.infer<typeof HoursSchema>;
export const RateCardSchema = z.strictObject({
  currency: CurrencySchema,
  hourly_rate_minor: positiveMinor,
  effort_hours: z.strictObject({ xs: HoursSchema.default(0.5), s: HoursSchema.default(1.5), m: HoursSchema.default(4), l: HoursSchema.default(8) }).default({ xs: 0.5, s: 1.5, m: 4, l: 8 }),
  deliverables: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/), name: z.string().min(1).max(80), price_minor: positiveMinor, unit: z.string().max(40) })).max(20).refine(ds => new Set(ds.map(d => d.id)).size === ds.length, 'Deliverable ids must be unique'),
  revision_rounds_included: z.number().int().min(0).max(20),
  revision_rounds_used: z.number().int().min(0).max(50),
  freelancer_name: z.string().max(80), client_name: z.string().max(80), project_name: z.string().max(120),
});
export type RateCard = z.infer<typeof RateCardSchema>;
export function defaultRateCard(): RateCard {
  return { currency: 'SGD', hourly_rate_minor: 8000, effort_hours: { xs: 0.5, s: 1.5, m: 4, l: 8 }, deliverables: [], revision_rounds_included: 2, revision_rounds_used: 0, freelancer_name: '', client_name: '', project_name: '' };
}
export const SpanSchema = z.strictObject({ start: nonnegativeInt, end: nonnegativeInt }).refine(s => s.end >= s.start, 'Span end precedes start');
export type Span = z.infer<typeof SpanSchema>;
export const ClauseSchema = z.strictObject({ id: z.string().regex(/^C[1-9]\d{0,2}$/), start: nonnegativeInt, end: nonnegativeInt, text: z.string() }).refine(c => c.end >= c.start && c.text.length === c.end - c.start, 'Clause must match its range length');
export type Clause = z.infer<typeof ClauseSchema>;

// Evidence fields intentionally precede the classification fields (plan §4.4).
export const ModelItemSchema = z.strictObject({
  message_quote: z.string().min(1).max(300), request: z.string().min(1).max(140),
  clause_id: z.string(), brief_quote: z.string().max(300), label: LabelSchema,
  included_basis: BasisSchema, reason: z.string().min(1).max(200), question: z.string().max(200),
  deliverable_id: z.string(), effort: EffortSchema,
});
export const ModelOutputSchema = z.strictObject({ items: z.array(ModelItemSchema).max(8) });
export type ModelOutput = z.infer<typeof ModelOutputSchema>;
export function makeModelOutputSchema(clauseIds: string[], deliverableIds: string[]) {
  return z.strictObject({ items: z.array(ModelItemSchema.extend({
    clause_id: z.enum(['none', ...clauseIds]),
    deliverable_id: z.enum(['none', 'custom', ...deliverableIds]),
  })).max(8) });
}
export const AnalysisItemSchema = z.strictObject({
  id: z.string(), request: z.string(), message_quote: z.string(), message_span: SpanSchema.nullable(),
  model_label: LabelSchema, label: LabelSchema, reason: z.string(), question: z.string(), reason_codes: z.array(ReasonCodeSchema),
  model_clause_id: z.string().nullable(), clause_id: z.string().nullable(), brief_quote: z.string(), brief_span: SpanSchema.nullable(), citation_status: CitationStatusSchema,
  included_basis: BasisSchema, deliverable_id: z.string(), effort: EffortSchema,
  pricing: z.strictObject({ mode: z.enum(['none', 'hourly', 'fixed']), hours_hundredths: z.number().int().min(1).max(50_000).nullable(), quantity: z.number().int().min(1).max(999) }),
  review: ReviewSchema, edited: z.boolean(), duplicate_of: z.string().nullable(), injection_overlap: z.boolean(),
});
export type AnalysisItem = z.infer<typeof AnalysisItemSchema>;
export const InjectionSchema = z.strictObject({ suspected: z.boolean(), spans: z.array(z.strictObject({ start: nonnegativeInt, end: nonnegativeInt, pattern: z.string() })) });
export type Injection = z.infer<typeof InjectionSchema>;
export const TruncatedSchema = z.strictObject({ brief: z.boolean(), message: z.boolean(), brief_dropped_chars: nonnegativeInt, message_dropped_chars: nonnegativeInt });
export const AnalysisSchema = z.strictObject({
  id: z.string().uuid(), reference: z.string().regex(/^SF-[a-f0-9]{8}$/), mode: z.enum(['live', 'fixture']),
  model: z.strictObject({ id: z.string(), file: z.string().nullable(), runtime: z.string(), provenance: z.string().optional() }),
  prompt_version: z.string(), created_at: z.string().datetime(), latency_ms: nonnegativeInt, attempts: z.number().int().min(1).max(3),
  timings: z.strictObject({ prompt_tokens: nonnegativeInt, predicted_tokens: nonnegativeInt, prompt_ms: z.number().nonnegative(), predicted_ms: z.number().nonnegative() }).nullable(),
  input: z.strictObject({ brief: z.string(), message: z.string(), rate_card: RateCardSchema }), truncated: TruncatedSchema,
  clauses: z.array(ClauseSchema), injection: InjectionSchema, items: z.array(AnalysisItemSchema),
  warnings: z.array(z.strictObject({ code: z.union([ReasonCodeSchema, z.enum(['no_items_found', 'items_capped'])]), message: z.string(), item_id: z.string().optional() })), raw_model_output: z.string(),
});
export type Analysis = z.infer<typeof AnalysisSchema>;
export const PricedOrderSchema = z.strictObject({
  currency: CurrencySchema,
  lines: z.array(z.strictObject({ item_id: z.string(), section: z.enum(['extra_work', 'revision_beyond_allowance']), description: z.string(), mode: z.enum(['hourly', 'fixed']), hours_hundredths: nonnegativeInt.nullable(), rate_minor: nonnegativeInt.nullable(), quantity: nonnegativeInt.nullable(), unit_price_minor: nonnegativeInt.nullable(), amount_minor: nonnegativeInt })),
  covered: z.array(z.strictObject({ item_id: z.string(), description: z.string(), brief_quote: z.string(), clause_id: z.string().nullable(), basis: BasisSchema, revision_round: nonnegativeInt.nullable(), user_override: z.boolean() })),
  questions: z.array(z.strictObject({ item_id: z.string(), question: z.string(), message_quote: z.string() })),
  revision: z.strictObject({ included: nonnegativeInt, used_before: nonnegativeInt, used_by_this_message: z.union([z.literal(0), z.literal(1)]), remaining_after: nonnegativeInt, beyond_allowance: z.boolean() }),
  subtotal_minor: nonnegativeInt, total_minor: nonnegativeInt,
  errors: z.array(z.strictObject({ item_id: z.string(), code: z.enum(['hours_required', 'hours_invalid', 'quantity_invalid', 'unknown_deliverable']) })),
  unreviewed_count: nonnegativeInt, exportable: z.boolean(),
});
export type PricedOrder = z.infer<typeof PricedOrderSchema>;
export const OrderMetaSchema = z.strictObject({ reference: z.string(), date_iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), project_name: z.string(), client_name: z.string(), freelancer_name: z.string() });
export type OrderMeta = z.infer<typeof OrderMetaSchema>;
