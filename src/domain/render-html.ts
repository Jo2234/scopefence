import type { OrderMeta, PricedOrder } from './schemas';
import { formatHours, formatMoney } from './money';
function escape(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
export function renderHtml(order: PricedOrder, meta: OrderMeta): string {
  const money = (minor: number) => escape(formatMoney(minor, order.currency));
  const rows = order.lines.map(line => `<tr><td>${escape(line.description)}</td><td>${line.section === 'revision_beyond_allowance' ? 'Revision beyond allowance' : 'Extra work'}</td><td>${line.mode === 'hourly' ? `${escape(formatHours(line.hours_hundredths!))} h` : escape(line.quantity!)}</td><td>${money(line.mode === 'hourly' ? line.rate_minor! : line.unit_price_minor!)}${line.mode === 'hourly' ? '/h' : '/unit'}</td><td>${money(line.amount_minor)}</td></tr>`).join('\n');
  const covered = order.covered.map(c => `<li><p>${escape(c.description)}</p>${c.user_override ? '<p>Your judgement, no brief clause cited.</p>' : `<blockquote>${escape(c.brief_quote)}</blockquote><p>${escape(c.clause_id ?? 'No clause id')}</p>`}${c.revision_round !== null ? `<p>Revision round ${escape(c.revision_round)} of ${escape(order.revision.included)}.</p>` : ''}</li>`).join('\n');
  const questions = order.questions.map(q => `<li><p>${escape(q.question)}</p><blockquote>${escape(q.message_quote)}</blockquote></li>`).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Change order ${escape(meta.reference)}</title>
<style>
body{font-family:system-ui,sans-serif;color:#17212b;background:#fff;max-width:960px;margin:2rem auto;padding:0 1.5rem;line-height:1.5}h1,h2{line-height:1.2}h2{margin-top:2rem}dl{display:grid;grid-template-columns:7rem 1fr;gap:.3rem}dt{font-weight:600}dd{margin:0;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #b9c2ca;text-align:left;padding:.6rem;vertical-align:top;overflow-wrap:anywhere}blockquote{border-left:3px solid #a8b4c0;margin:1rem 0;padding-left:1rem;white-space:pre-wrap;overflow-wrap:anywhere}footer{border-top:1px solid #b9c2ca;margin-top:2rem;padding-top:1rem;font-size:.85rem}li{break-inside:avoid}p{overflow-wrap:anywhere}@media print{body{max-width:none;margin:0;padding:0;color:#000;font-size:10pt}h1,h2{break-after:avoid}thead{display:table-header-group}tr,blockquote{break-inside:avoid}@page{margin:18mm}}
</style></head><body>
<h1>Change order ${escape(meta.reference)}</h1>
<dl><dt>Project</dt><dd>${escape(meta.project_name)}</dd><dt>Client</dt><dd>${escape(meta.client_name)}</dd><dt>Prepared by</dt><dd>${escape(meta.freelancer_name)}</dd><dt>Date</dt><dd>${escape(meta.date_iso)}</dd></dl>
<h2>Summary</h2><p>The additional work totals ${money(order.total_minor)}.</p>
<h2>Additional work</h2><table><thead><tr><th>Description</th><th>Basis</th><th>Qty/hours</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No additional charges</td></tr>'}</tbody></table>
<h2>Total: ${money(order.total_minor)}</h2>
<h2>Already covered by the agreed brief</h2>${covered ? `<ul>${covered}</ul>` : '<p>None.</p>'}
<h2>Questions before we proceed</h2>${questions ? `<ul>${questions}</ul>` : '<p>None.</p>'}
<h2>Revision rounds</h2><p>${escape(order.revision.used_before)} of ${escape(order.revision.included)} used before this message; this message uses ${order.revision.used_by_this_message === 0 ? 'no revision round' : '1 revision round'}; ${escape(order.revision.remaining_after)} remaining.</p><p>${order.revision.beyond_allowance ? 'Revisions in this message exceed the included allowance and are charged above.' : 'Revisions in this message are within the included allowance.'}</p>
<footer>Draft prepared with ScopeFence. Please review before sending. This is not legal advice.</footer>
</body></html>`;
}
