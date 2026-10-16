import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PricedOrderSchema, priceOrder, type AnalysisItem } from '../../src/domain';
import { analysisItem, deepFreeze, rateCard } from './helpers';
const settings = { numRuns: 250, seed: 20261016 };
const hours = fc.option(fc.integer({ min: 1, max: 50_000 }), { nil: null });
const itemArb = fc.record({
  label: fc.constantFrom('included' as const, 'needs_clarification' as const, 'extra_work' as const),
  basis: fc.constantFrom('deliverable' as const, 'revision' as const),
  review: fc.constantFrom('approved' as const, 'excluded' as const, 'proposed' as const),
  fixed: fc.boolean(), hours, quantity: fc.integer({ min: 1, max: 999 }), duplicate: fc.boolean(),
}).map(r => analysisItem({ label: r.label, included_basis: r.label === 'included' ? r.basis : 'none', review: r.review, deliverable_id: r.fixed ? 'social-kit' : 'custom', duplicate_of: r.duplicate ? 'earlier' : null, pricing: { mode: r.fixed ? 'fixed' : 'hourly', hours_hundredths: r.hours, quantity: r.quantity } }));
const itemsArb = fc.array(itemArb, { maxLength: 20 }).map(items => items.map((i, n) => ({ ...i, id: `I${n + 1}` })));
const cardArb = fc.record({ rate: fc.integer({ min: 1, max: 100_000_000 }), included: fc.integer({ min: 0, max: 20 }), used: fc.integer({ min: 0, max: 50 }) }).map(x => ({ ...rateCard(), hourly_rate_minor: x.rate, revision_rounds_included: x.included, revision_rounds_used: x.used }));
describe('priceOrder acceptance examples', () => {
  it('A3 prices approved extras and lists included deliverables with SGD total 55000', () => {
    const order = priceOrder([analysisItem({ id: 'I1' }), analysisItem({ id: 'I2', deliverable_id: 'social-kit', pricing: { mode: 'fixed', quantity: 1, hours_hundredths: null } }), analysisItem({ id: 'I3', label: 'included', included_basis: 'deliverable' })], rateCard());
    expect(order.lines.map(l => l.amount_minor)).toEqual([20000, 35000]); expect(order.total_minor).toBe(55000); expect(order.covered.map(c => c.item_id)).toEqual(['I3']); expect(order.exportable).toBe(true);
  });
  it('A4 consumes a single revision round for two items and bills both only beyond the allowance', () => {
    const items = [analysisItem({ id: 'I1', label: 'included', included_basis: 'revision', pricing: { mode: 'hourly', hours_hundredths: 100, quantity: 1 } }), analysisItem({ id: 'I2', label: 'included', included_basis: 'revision', pricing: { mode: 'hourly', hours_hundredths: 50, quantity: 1 } })];
    const covered = priceOrder(items, rateCard());
    expect(covered.covered.map(c => c.revision_round)).toEqual([2, 2]); expect(covered.revision).toEqual({ included: 2, used_before: 1, used_by_this_message: 1, remaining_after: 0, beyond_allowance: false }); expect(covered.total_minor).toBe(0);
    const billed = priceOrder(items, { ...rateCard(), revision_rounds_used: 2 });
    expect(billed.lines.map(l => [l.section, l.amount_minor])).toEqual([['revision_beyond_allowance', 8000], ['revision_beyond_allowance', 4000]]); expect(billed.total_minor).toBe(12000); expect(billed.revision.beyond_allowance).toBe(true);
  });
  it('A5 missing approved hours block export and never create a zero-priced line', () => {
    const order = priceOrder([analysisItem({ pricing: { mode: 'hourly', hours_hundredths: null, quantity: 1 } })], rateCard());
    expect(order.errors).toEqual([{ item_id: 'I1', code: 'hours_required' }]); expect(order.exportable).toBe(false); expect(order.lines).toEqual([]);
  });
  it('A6 proposed rows block export; excluded and duplicate rows never charge', () => {
    const order = priceOrder([analysisItem({ id: 'proposed', review: 'proposed' }), analysisItem({ id: 'excluded', review: 'excluded' }), analysisItem({ id: 'duplicate', duplicate_of: 'earlier' })], rateCard());
    expect(order.unreviewed_count).toBe(1); expect(order.exportable).toBe(false); expect(order.total_minor).toBe(0); expect(order.lines).toEqual([]);
  });
  it('reports invalid hours, quantities, and removed fixed deliverables', () => {
    for (const invalid of [0, -1, 0.5, 50001, NaN, Infinity]) {
      expect(priceOrder([analysisItem({ pricing: { mode: 'hourly', hours_hundredths: invalid, quantity: 1 } })], rateCard()).errors).toEqual([{ item_id: 'I1', code: 'hours_invalid' }]);
    }
    for (const invalid of [0, -1, 1.5, 1000, NaN]) {
      expect(priceOrder([analysisItem({ deliverable_id: 'social-kit', pricing: { mode: 'fixed', hours_hundredths: null, quantity: invalid } })], rateCard()).errors[0]!.code).toBe('quantity_invalid');
    }
    expect(priceOrder([analysisItem({ deliverable_id: 'removed', pricing: { mode: 'fixed', hours_hundredths: null, quantity: 1 } })], rateCard()).errors[0]!.code).toBe('unknown_deliverable');
  });
  it('uses question text, falling back to reason, only for approved clarification rows', () => {
    const order = priceOrder([analysisItem({ id: 'I1', label: 'needs_clarification', question: '' }), analysisItem({ id: 'I2', label: 'needs_clarification', question: 'Which format?' })], rateCard());
    expect(order.questions.map(q => q.question)).toEqual(['An additional request.', 'Which format?']); expect(order.total_minor).toBe(0);
  });
});
describe('seeded pricing invariants (250 runs each)', () => {
  it('I1 totals equal the line sum and all amounts are nonnegative safe integers', () => {
    fc.assert(fc.property(itemsArb, cardArb, (items, card) => {
      const order = priceOrder(items, card);
      expect(order.total_minor).toBe(order.lines.reduce((sum, l) => sum + l.amount_minor, 0)); expect(order.subtotal_minor).toBe(order.total_minor);
      expect(Number.isSafeInteger(order.total_minor)).toBe(true);
      for (const line of order.lines) {
        expect(Number.isSafeInteger(line.amount_minor)).toBe(true); expect(line.amount_minor).toBeGreaterThanOrEqual(0);
        const expected = line.mode === 'fixed' ? BigInt(line.quantity!) * BigInt(line.unit_price_minor!) : (BigInt(line.hours_hundredths!) * BigInt(line.rate_minor!) + 50n) / 100n;
        expect(line.amount_minor).toBe(Number(expected));
      }
      expect(PricedOrderSchema.safeParse(order).success).toBe(true);
    }), settings);
  });
  it('I2 is pure and deterministic for deeply frozen inputs', () => {
    fc.assert(fc.property(itemsArb, cardArb, (items, card) => {
      const before = structuredClone({ items, card }); deepFreeze(items); deepFreeze(card);
      expect(priceOrder(items, card)).toEqual(priceOrder(items, card)); expect({ items, card }).toEqual(before);
    }), settings);
  });
  it('I3 excluded, duplicate and unreviewed items never change prices or lines', () => {
    fc.assert(fc.property(itemsArb, cardArb, (items, card) => {
      const base = priceOrder(items, card);
      const ignored: AnalysisItem[] = [analysisItem({ review: 'excluded' }), analysisItem({ duplicate_of: 'I1' }), analysisItem({ review: 'proposed' })];
      const result = priceOrder([...items, ...ignored], card);
      expect(result.total_minor).toBe(base.total_minor); expect(result.lines).toEqual(base.lines);
    }), settings);
  });
  it('I4 permuting non-revision items preserves the total', () => {
    fc.assert(fc.property(itemsArb, cardArb, (items, card) => {
      const nonRevision = items.map(i => ({ ...i, included_basis: 'deliverable' as const }));
      expect(priceOrder(nonRevision, card).total_minor).toBe(priceOrder([...nonRevision].reverse(), card).total_minor);
    }), settings);
  });
  it('I5 revisions consume at most one round and charge iff the allowance is exhausted', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 1, max: 50000 }), { maxLength: 8 }), cardArb, (hours, card) => {
      const items = hours.map((h, n) => analysisItem({ id: `I${n + 1}`, label: 'included', included_basis: 'revision', pricing: { mode: 'hourly', hours_hundredths: h, quantity: 1 } }));
      const order = priceOrder(items, card); const exhausted = card.revision_rounds_used >= card.revision_rounds_included;
      expect(order.revision.used_by_this_message).toBe(hours.length ? 1 : 0); expect(order.revision.remaining_after).toBe(Math.max(0, card.revision_rounds_included - card.revision_rounds_used - (hours.length ? 1 : 0)));
      expect(order.lines).toHaveLength(exhausted ? hours.length : 0); expect(order.covered).toHaveLength(exhausted ? 0 : hours.length);
      expect(order.revision.beyond_allowance).toBe(exhausted && hours.length > 0);
    }), settings);
  });
  it('I8 exportable is exactly zero errors and zero proposed rows', () => {
    fc.assert(fc.property(itemsArb, cardArb, (items, card) => {
      const order = priceOrder(items, card);
      expect(order.unreviewed_count).toBe(items.filter(i => i.review === 'proposed').length);
      expect(order.exportable).toBe(order.errors.length === 0 && order.unreviewed_count === 0);
    }), settings);
  });
});
