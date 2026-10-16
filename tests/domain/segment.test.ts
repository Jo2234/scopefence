import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { segmentBrief } from '../../src/domain';
describe('segmentBrief', () => {
  it('preserves exact UTF-16 ranges over random multiline text, CRLF, emoji and curly quotes', () => {
    fc.assert(fc.property(fc.array(fc.array(fc.constantFrom('a', ' ', '\t', '😀', '“', '’', '.', '\r'), { maxLength: 80 }).map(xs => xs.join('')), { maxLength: 160 }), lines => {
      const brief = lines.join('\n');
      const { clauses } = segmentBrief(brief);
      clauses.forEach((c, i) => {
        expect(c.text).toBe(brief.slice(c.start, c.end));
        expect(c.text).toBe(c.text.trim()); expect(c.text.length).toBeGreaterThan(0);
        expect(c.id).toBe(`C${i + 1}`);
        if (i > 0) expect(c.start).toBeGreaterThanOrEqual(clauses[i - 1]!.end);
      });
    }), { numRuns: 250, seed: 20261016 });
  });
  it('retains every bullet style and skips blank lines', () => {
    expect(segmentBrief('  - Logo\r\n\n * Card\n• Palette\n1. Favicon\na) Revisions ').clauses.map(c => c.text)).toEqual(['- Logo', '* Card', '• Palette', '1. Favicon', 'a) Revisions']);
  });
  it('splits long lines only at the specified sentence boundaries', () => {
    const first = 'A'.repeat(281) + '.';
    expect(segmentBrief(`${first}  Next sentence; “Quoted.” (Another)`).clauses.map(c => c.text)).toEqual([first, 'Next sentence;', '“Quoted.” (Another)']);
    expect(segmentBrief('Short. Next.').clauses).toHaveLength(1);
    expect(segmentBrief('x'.repeat(400)).clauses).toHaveLength(1);
  });
  it('caps at 120 nonempty clauses and reports dropped clauses', () => {
    const result = segmentBrief(Array.from({ length: 121 }, (_, i) => `Line ${i}`).join('\n'));
    expect(result.clauses).toHaveLength(120); expect(result.capped).toBe(true);
    expect(segmentBrief('x\n'.repeat(120)).capped).toBe(false);
  });
});
