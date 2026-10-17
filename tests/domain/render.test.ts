import { expect, it } from 'vitest';
import { priceOrder, renderHtml, renderMarkdown, type OrderMeta } from '../../src/domain';
import { analysisItem, rateCard } from './helpers';
const meta: OrderMeta = { reference: 'SF-12345678', date_iso: '2026-10-16', project_name: 'Maple & Fern', client_name: 'Fictional client', freelancer_name: 'Fictional designer' };
it('A16 XSS falsifier: every interpolated string is escaped, with no scripts or external resources', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const quote = '</style><script>alert(1)</script>';
  const order = priceOrder([
    analysisItem({ id: 'I1', request: attack }),
    analysisItem({ id: 'I2', label: 'included', included_basis: 'deliverable', brief_quote: quote, clause_id: '\"><img src=x onerror=alert(1)>' }),
    analysisItem({ id: 'I3', label: 'needs_clarification', question: attack, message_quote: quote }),
  ], rateCard());
  const html = renderHtml(order, { reference: attack, date_iso: quote, project_name: attack, client_name: quote, freelancer_name: `O'Fake & \"Designer\"` });
  expect(html.startsWith('<!doctype html>')).toBe(true); expect(html).toContain('@media print');
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;'); expect(html).toContain('&lt;/style&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).toContain('O&#39;Fake &amp; &quot;Designer&quot;'); expect(html).not.toMatch(/<script\b/i);
  const tags = html.match(/<[^>]+>/g) ?? [];
  expect(tags.some(tag => /\bonerror\s*=/i.test(tag))).toBe(false);
  expect(html).not.toMatch(/https?:|<link\b|<iframe\b|<img\b/i);
  expect(tags.some(tag => /\b(src|href)\s*=/i.test(tag))).toBe(false);
  const md = renderMarkdown(priceOrder([analysisItem({ request: 'Logo | card\nsecond line' })], rateCard()), meta);
  expect(md).toContain('| Logo \\| card second line |');
});
it('A17 exports the exact total, all approved lines, questions and footer, omitting unreviewed and excluded rows', () => {
  const order = priceOrder([
    analysisItem({ id: 'I1', request: 'Animated intro' }),
    analysisItem({ id: 'I2', request: 'Social templates', deliverable_id: 'social-kit', pricing: { mode: 'fixed', quantity: 1, hours_hundredths: null } }),
    analysisItem({ id: 'I3', label: 'needs_clarification', question: 'Which dimensions?', message_quote: 'make it bigger' }),
    analysisItem({ id: 'I4', request: 'PROPOSED SECRET', review: 'proposed' }),
    analysisItem({ id: 'I5', request: 'EXCLUDED SECRET', review: 'excluded' }),
    analysisItem({ id: 'I6', request: 'Covered logo', label: 'included', included_basis: 'deliverable' }),
  ], rateCard());
  const md = renderMarkdown(order, meta); const html = renderHtml(order, meta);
  for (const output of [md, html]) {
    for (const expected of ['SGD\u00a0550.00', 'Animated intro', 'Social templates', 'Which dimensions?', 'make it bigger', 'Covered logo', 'Two logo concepts in full colour.', 'This is not legal advice.']) expect(output).toContain(expected);
    expect(output).not.toContain('PROPOSED SECRET'); expect(output).not.toContain('EXCLUDED SECRET');
    const sections = ['Change order SF-12345678', 'Project', 'Summary', 'Additional work', 'Total:', 'Already covered by the agreed brief', 'Questions before we proceed', 'Revision rounds', 'Draft prepared with ScopeFence'];
    for (let i = 1; i < sections.length; i++) expect(output.indexOf(sections[i]!)).toBeGreaterThan(output.indexOf(sections[i - 1]!));
  }
});
it('shows revision round k of N and identifies user judgements without presenting invalid quotes as evidence', () => {
  const order = priceOrder([
    analysisItem({ id: 'I1', label: 'included', included_basis: 'revision' }),
    analysisItem({ id: 'I2', request: 'User decision', label: 'included', included_basis: 'deliverable', citation_status: 'not_found', brief_quote: 'INVALID CITATION', reason_codes: ['user_override'] }),
  ], rateCard());
  for (const output of [renderHtml(order, meta), renderMarkdown(order, meta)]) {
    expect(output).toContain('Revision round 2 of 2.'); expect(output).toContain('Your judgement, no brief clause cited.'); expect(output).not.toContain('INVALID CITATION');
  }
});
it('renders a self-contained empty order with all required sections', () => {
  const order = priceOrder([], rateCard());
  for (const output of [renderHtml(order, meta), renderMarkdown(order, meta)]) { expect(output).toContain('No additional charges'); expect(output).toContain('SGD\u00a00.00'); expect(output).toContain('None.'); }
});
it('preserves ampersands in Markdown while escaping raw HTML and table delimiters', () => {
  const attack = '<img src=x onerror=alert(1)>';
  const order = priceOrder([
    analysisItem({ id: 'I1', request: `Logo & card | ${attack}\nsecond line` }),
    analysisItem({ id: 'I2', label: 'included', included_basis: 'deliverable', brief_quote: attack }),
    analysisItem({ id: 'I3', label: 'needs_clarification', question: attack, message_quote: attack }),
  ], rateCard());
  const md = renderMarkdown(order, { ...meta, client_name: 'Maple & Fern Bakery', project_name: attack });
  expect(md).toContain('Client: Maple & Fern Bakery');
  expect(md).toContain('Logo & card \\| \\<img src=x onerror=alert\\(1\\)\\> second line');
  expect(md).not.toMatch(/&(?:amp|lt|gt);/);
  // An even number of preceding backslashes leaves the angle bracket unescaped.
  expect(md).not.toMatch(/(^|[^\\])(?:\\\\)*<img\b/im);
});
it.each([0, 1] as const)('uses natural revision-round grammar for %i rounds in both renderers', count => {
  const order = priceOrder(count ? [analysisItem({ label: 'included', included_basis: 'revision' })] : [], rateCard());
  for (const output of [renderMarkdown(order, meta), renderHtml(order, meta)]) {
    expect(output).toContain(`this message uses ${count === 0 ? 'no revision round' : '1 revision round'};`);
    expect(output).not.toContain(`this message uses ${count} round`);
  }
});
it.each([false, true])('separates every Markdown section heading from preceding content (covered rows: %s)', covered => {
  const order = priceOrder(covered ? [analysisItem({ label: 'included', included_basis: 'deliverable' })] : [], rateCard());
  const lines = renderMarkdown(order, meta).split('\n');
  const headings = lines.flatMap((line, index) => line.startsWith('## ') ? [index] : []);
  expect(headings).toHaveLength(6);
  for (const index of headings) expect(lines[index - 1]).toBe('');
});
