import { expect, it } from 'vitest';
import { clauseAt, findExact, normaliseForDedupe, overlapLen, segmentBrief } from '../../src/domain';
it('finds the first exact UTF-16 occurrence without typography, case or whitespace normalisation', () => {
  expect(findExact('😀 client’s logo client’s', 'client’s')).toEqual({ start: 3, end: 11 });
  expect(findExact('client’s', "client's")).toBeNull();
  expect(findExact('Logo  design', 'logo design')).toBeNull(); expect(findExact('abc', '')).toBeNull();
});
it('uses half-open overlap and clause membership', () => {
  expect(overlapLen({ start: 0, end: 4 }, { start: 3, end: 7 })).toBe(1);
  expect(overlapLen({ start: 0, end: 4 }, { start: 4, end: 7 })).toBe(0);
  const clauses = segmentBrief('  Logo  \n Card').clauses;
  expect(clauseAt(clauses, 2)?.id).toBe('C1'); expect(clauseAt(clauses, 6)).toBeNull(); expect(clauseAt(clauses, 0)).toBeNull();
});
it('normalises only for deduplication', () => {
  expect(normaliseForDedupe('  DARK\n Mode\t')).toBe('dark mode');
  expect(normaliseForDedupe('client’s')).not.toBe(normaliseForDedupe("client's"));
});
