import { expect, it } from 'vitest';
import { LIMITS, reconcile, truncateInputs } from '../../src/domain';
import { context, modelItem } from './helpers';
it('cuts a 9000-character brief to 8000 and reports exact dropped character counts', () => {
  const result = truncateInputs('a'.repeat(9000), 'b'.repeat(5000));
  expect(LIMITS).toEqual({ brief_chars: 8000, message_chars: 4000 });
  expect(result.brief_analysed).toHaveLength(8000); expect(result.message_analysed).toHaveLength(4000);
  expect(result.truncated).toEqual({ brief: true, message: true, brief_dropped_chars: 1000, message_dropped_chars: 1000 });
});
it('backs up to nearby whitespace without searching farther than 200 characters', () => {
  const brief = 'a'.repeat(7900) + ' ' + 'b'.repeat(1100);
  expect(truncateInputs(brief, '').brief_analysed).toBe('a'.repeat(7900));
  expect(truncateInputs('a'.repeat(7799) + ' ' + 'b'.repeat(2000), '').brief_analysed).toHaveLength(8000);
  expect(truncateInputs('a'.repeat(7800) + ' ' + 'b'.repeat(2000), '').brief_analysed).toHaveLength(7800);
});
it('leaves inputs at or below the limits unchanged', () => {
  expect(truncateInputs(' a \n', 'b').brief_analysed).toBe(' a \n');
  expect(truncateInputs('a'.repeat(8000), 'b'.repeat(4000)).truncated).toEqual({ brief: false, message: false, brief_dropped_chars: 0, message_dropped_chars: 0 });
});
it('scripted citations beyond the analysed prefix still verify against the full original brief', () => {
  const brief = 'a'.repeat(9000) + '\nTwo revision rounds are included.';
  const ctx = context(brief); ctx.brief_analysed = truncateInputs(brief, '').brief_analysed;
  const result = reconcile({ items: [modelItem({ brief_quote: 'Two revision rounds are included.' })] }, ctx);
  expect(result.items[0]!.citation_status).toBe('verified'); expect(result.items[0]!.brief_span!.start).toBe(9001);
});
