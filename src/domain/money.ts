import type { Currency } from './schemas';
/** Parse decimal text directly to integer minor units, without float arithmetic. */
export function parseMajorToMinor(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new RangeError('Amount must be a non-negative decimal with at most two decimal places');
  const [major, fraction = ''] = value.split('.');
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor)) throw new RangeError('Amount exceeds safe integer range');
  return minor;
}
/** Returns integer hundredths of an hour. */
export function parseHours(value: string): number {
  const hundredths = parseMajorToMinor(value);
  if (hundredths < 1 || hundredths > 50_000) throw new RangeError('Hours must be greater than zero and at most 500');
  return hundredths;
}
export function roundHalfUpDiv100(numerator: number): number {
  if (!Number.isSafeInteger(numerator) || numerator < 0) throw new RangeError('Expected a non-negative safe integer');
  // Equivalent to floor((n + 50) / 100), without overflowing n + 50.
  return Math.floor(numerator / 100) + (numerator % 100 >= 50 ? 1 : 0);
}
export function formatMoney(minor: number, currency: Currency): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'symbol' }).format(minor / 100);
}
export function formatHours(hours_hundredths: number): string {
  if (!Number.isSafeInteger(hours_hundredths) || hours_hundredths < 0) throw new RangeError('Expected non-negative hours in hundredths');
  const whole = Math.floor(hours_hundredths / 100);
  const fraction = String(hours_hundredths % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}
