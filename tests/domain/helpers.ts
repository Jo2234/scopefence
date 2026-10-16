import { defaultRateCard, detectInjection, segmentBrief, type ModelOutput, type RateCard, type ReconcileContext } from '../../src/domain';
export const BRIEF = 'Two logo concepts in full colour.\nA business card design.\nTwo revision rounds are included.';
export const MESSAGE = 'Please make the tagline bigger and add dark mode.';
export function rateCard(): RateCard {
  return { ...defaultRateCard(), deliverables: [{ id: 'social-kit', name: 'Social media kit', price_minor: 35000, unit: 'per kit' }], revision_rounds_used: 1 };
}
export function modelItem(overrides: Partial<ModelOutput['items'][number]> = {}): ModelOutput['items'][number] {
  return { message_quote: 'make the tagline bigger', request: 'Enlarge the tagline', clause_id: 'C1', brief_quote: 'Two logo concepts in full colour.', label: 'included', included_basis: 'revision', reason: 'A revision to the agreed logo.', question: '', deliverable_id: 'none', effort: 's', ...overrides };
}
export function context(brief = BRIEF, message = MESSAGE, card = rateCard()): ReconcileContext {
  return { brief_original: brief, brief_analysed: brief, message_analysed: message, clauses: segmentBrief(brief).clauses, rate_card: card, injection: detectInjection(message) };
}
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) deepFreeze(child); }
  return value;
}
