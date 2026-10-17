import type { OrderMeta, PricedOrder } from './schemas';
import { formatHours, formatMoney } from './money';
function text(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]()#!|])/g, '\\$1').replace(/[\r\n]+/g, ' ');
}
export function renderMarkdown(order: PricedOrder, meta: OrderMeta): string {
  const money = (minor: number) => text(formatMoney(minor, order.currency));
  const lines = [
    `# Change order ${text(meta.reference)}`, '',
    `Project: ${text(meta.project_name)}  `, `Client: ${text(meta.client_name)}  `,
    `Prepared by: ${text(meta.freelancer_name)}  `, `Date: ${text(meta.date_iso)}`, '',
    '## Summary', '', `The additional work totals ${money(order.total_minor)}.`, '',
    '## Additional work', '', '| Description | Basis | Qty/hours | Rate | Amount |', '| --- | --- | --- | --- | --- |',
  ];
  for (const line of order.lines) lines.push(`| ${text(line.description)} | ${line.section === 'revision_beyond_allowance' ? 'Revision beyond allowance' : 'Extra work'} | ${line.mode === 'hourly' ? `${formatHours(line.hours_hundredths!)} h` : `${line.quantity}`} | ${money(line.mode === 'hourly' ? line.rate_minor! : line.unit_price_minor!)}${line.mode === 'hourly' ? '/h' : '/unit'} | ${money(line.amount_minor)} |`);
  if (!order.lines.length) lines.push('| No additional charges | | | | |');
  lines.push('', `## Total: ${money(order.total_minor)}`, '', '## Already covered by the agreed brief', '');
  if (!order.covered.length) lines.push('None.');
  for (const covered of order.covered) {
    lines.push(`- ${text(covered.description)}`);
    if (covered.user_override) lines.push('  Your judgement, no brief clause cited.');
    else {
      lines.push(`  ${covered.clause_id ? text(covered.clause_id) : 'No clause id'}`);
      for (const quoteLine of covered.brief_quote.split(/\r?\n/)) lines.push(`  > ${text(quoteLine)}`);
    }
    if (covered.revision_round !== null) lines.push(`  Revision round ${covered.revision_round} of ${order.revision.included}.`);
    lines.push('');
  }
  lines.push('## Questions before we proceed', '');
  if (!order.questions.length) lines.push('None.');
  for (const q of order.questions) lines.push(`- ${text(q.question)} (Message: “${text(q.message_quote)}”)`);
  lines.push('', '## Revision rounds', '', `${order.revision.used_before} of ${order.revision.included} used before this message; this message uses ${order.revision.used_by_this_message} round; ${order.revision.remaining_after} remaining.`, order.revision.beyond_allowance ? 'Revisions in this message exceed the included allowance and are charged above.' : 'Revisions in this message are within the included allowance.', '', 'Draft prepared with ScopeFence. Please review before sending. This is not legal advice.', '');
  return lines.join('\n');
}
