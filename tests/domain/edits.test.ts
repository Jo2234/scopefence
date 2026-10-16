import { expect, it } from 'vitest';
import { applyEdit, EditError } from '../../src/domain';
import { analysisItem, deepFreeze, rateCard } from './helpers';
it('allows a user to include an uncited item and records the override once', () => {
  const original = deepFreeze(analysisItem({ citation_status: 'absent', brief_quote: '', brief_span: null }));
  const edited = applyEdit(original, { label: 'included' }, rateCard());
  expect(edited.reason_codes).toEqual(['user_override']); expect(edited.edited).toBe(true); expect(edited.included_basis).toBe('deliverable'); expect(edited.pricing.mode).toBe('none');
  expect(applyEdit(edited, { label: 'included' }, rateCard()).reason_codes).toEqual(['user_override']); expect(original.edited).toBe(false);
});
it('hours 0 throw EditError with hours_invalid and leave the original untouched', () => {
  const original = deepFreeze(analysisItem());
  try { applyEdit(original, { hours: '0' }, rateCard()); throw new Error('Must reject zero hours'); }
  catch (error) { expect(error).toBeInstanceOf(EditError); expect((error as EditError).code).toBe('hours_invalid'); }
  expect(original.pricing.hours_hundredths).toBe(250);
});
it('label changes retain user-entered hours and quantity through included and extra states', () => {
  let item = applyEdit(analysisItem(), { hours: '3.25' }, rateCard()); item = applyEdit(item, { quantity: 4 }, rateCard());
  item = applyEdit(item, { label: 'included' }, rateCard()); item = applyEdit(item, { included_basis: 'revision' }, rateCard());
  expect(item.pricing).toEqual({ mode: 'hourly', hours_hundredths: 325, quantity: 4 });
  item = applyEdit(item, { label: 'extra_work' }, rateCard()); item = applyEdit(item, { deliverable_id: 'social-kit' }, rateCard());
  expect(item.pricing).toEqual({ mode: 'fixed', hours_hundredths: 325, quantity: 4 }); expect(item.included_basis).toBe('none');
  item = applyEdit(item, { deliverable_id: 'custom' }, rateCard()); expect(item.pricing.mode).toBe('hourly'); expect(item.pricing.hours_hundredths).toBe(325);
});
it('review transitions require excluded items to return to proposed before approval', () => {
  let item = analysisItem({ review: 'proposed' });
  for (const review of ['approved', 'proposed', 'excluded', 'proposed', 'approved', 'excluded'] as const) { item = applyEdit(item, { review }, rateCard()); expect(item.review).toBe(review); expect(item.edited).toBe(true); }
  expect(() => applyEdit(item, { review: 'approved' }, rateCard())).toThrow(EditError);
});
it('defaults pricing on label changes and applies question/request edits purely', () => {
  const original = deepFreeze(analysisItem({ label: 'needs_clarification', pricing: { mode: 'none', hours_hundredths: null, quantity: 1 }, effort: 'xs' }));
  expect(applyEdit(original, { label: 'extra_work' }, rateCard()).pricing.hours_hundredths).toBe(50);
  const revision = applyEdit(applyEdit({ ...original, effort: 'none' }, { label: 'included' }, rateCard()), { included_basis: 'revision' }, rateCard());
  expect(revision.pricing.hours_hundredths).toBe(150);
  expect(applyEdit(original, { question: 'Which size?' }, rateCard()).question).toBe('Which size?'); expect(applyEdit(original, { request: 'New description' }, rateCard()).request).toBe('New description');
  expect(() => applyEdit(original, { quantity: 0 }, rateCard())).toThrow(EditError); expect(() => applyEdit(original, { deliverable_id: 'unknown' }, rateCard())).toThrow(EditError);
});
it('reruns unknown deliverable defaults when a clarification is changed to extra work', () => {
  const edited = applyEdit(analysisItem({ label: 'needs_clarification', deliverable_id: 'removed' }), { label: 'extra_work' }, rateCard());
  expect(edited.deliverable_id).toBe('custom'); expect(edited.reason_codes).toContain('deliverable_unknown'); expect(edited.pricing.mode).toBe('hourly');
});
