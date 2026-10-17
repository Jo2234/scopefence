import { expect, it } from 'vitest';
import { formatHours, formatMoney, parseHours, parseMajorToMinor, roundHalfUpDiv100 } from '../../src/domain';
it('A1 parses decimal major units without exponent notation or silent rounding', () => {
  expect(parseMajorToMinor('80.00')).toBe(8000); expect(parseMajorToMinor('80')).toBe(8000); expect(parseMajorToMinor('0.1')).toBe(10);
  expect(parseMajorToMinor('0.29')).toBe(29);
  for (const value of ['80.001', '-5', '', '1e3', ' ', 'NaN', 'Infinity', '.1', '1.', '+1', ' 80', '80 ', '1,000', '9007199254740992']) expect(() => parseMajorToMinor(value)).toThrow();
});
it('A2 rounds half up: 1.33 hours at 75.55 is $100.48; tiny work may legitimately round to $0.00', () => {
  expect(roundHalfUpDiv100(133 * 7555)).toBe(10048); expect(formatMoney(roundHalfUpDiv100(133 * 7555), 'USD')).toBe('$100.48');
  expect(roundHalfUpDiv100(1 * 1)).toBe(0); expect(formatMoney(roundHalfUpDiv100(1), 'USD')).toBe('$0.00');
  expect(roundHalfUpDiv100(49)).toBe(0); expect(roundHalfUpDiv100(50)).toBe(1); expect(roundHalfUpDiv100(150)).toBe(2);
  for (const n of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => roundHalfUpDiv100(n)).toThrow();
  expect(roundHalfUpDiv100(Number.MAX_SAFE_INTEGER)).toBe(Number((BigInt(Number.MAX_SAFE_INTEGER) + 50n) / 100n));
});
it('I6 accepts only positive decimal hours up to 500 with at most two places', () => {
  for (const value of ['0', '-1', '', 'abc', '1.234', 'NaN', 'Infinity', '500.01', '501', '1e2', ' 2 ']) expect(() => parseHours(value)).toThrow();
  expect(parseHours('0.25')).toBe(25); expect(parseHours('2.5')).toBe(250); expect(parseHours('500')).toBe(50000); expect(parseHours('0.01')).toBe(1);
});
it('pins the observed Node 24.22 ICU en SGD symbol and nonbreaking space', () => {
  expect(formatMoney(55000, 'SGD')).toBe('SGD\u00a0550.00'); expect(formatMoney(12345, 'USD')).toBe('$123.45');
});
it('formats integer hundredths without floating tails or redundant zeroes', () => {
  expect([1, 25, 100, 250, 50000].map(formatHours)).toEqual(['0.01', '0.25', '1', '2.5', '500']);
});
