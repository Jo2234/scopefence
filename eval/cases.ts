import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { z } from 'zod';
import type { EvalCase } from './types.js';

// Temporary local §4.2 validator until RateCardSchema is merged (see cases.test.ts).
const hours = z.number().positive().max(500).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-8);
const minor = z.number().int().min(1).max(100_000_000);
export const LocalRateCardSchema = z.object({
  currency:z.enum(['SGD','USD','EUR','GBP','AUD','CAD','NZD','INR','MYR','PHP']),
  hourly_rate_minor:minor, effort_hours:z.object({xs:hours,s:hours,m:hours,l:hours}),
  deliverables:z.array(z.object({id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/),name:z.string().min(1).max(80),price_minor:minor,unit:z.string().max(40)})).max(20)
    .refine(ds => new Set(ds.map(d => d.id)).size === ds.length),
  revision_rounds_included:z.number().int().min(0).max(20),revision_rounds_used:z.number().int().min(0).max(50),
  freelancer_name:z.string().max(80),client_name:z.string().max(80),project_name:z.string().max(120),
});
export const EvalCaseSchema = z.object({
  id:z.string().regex(/^(dev|test)-\d{2}-[a-z0-9-]+$/),split:z.enum(['dev','test']),synthetic:z.literal(true),
  note:z.literal('Invented example for testing; not a real client or project.'),title:z.string().min(1),tags:z.array(z.string().min(1)).min(1),
  brief:z.string().min(1).max(8000),message:z.string().min(1).max(4000),rate_card:LocalRateCardSchema,
  expected_items:z.array(z.object({anchor:z.string().min(1),label:z.enum(['included','needs_clarification','extra_work']),clause_anchor:z.string().min(1).optional(),included_basis:z.enum(['deliverable','revision','none']),rationale:z.string().min(1)})).min(1).max(8),
  forbidden_included:z.array(z.string().min(1)),expect_injection:z.boolean(),
}).superRefine((c,ctx) => {
  const issue = (message:string) => ctx.addIssue({code:'custom',message});
  if (!c.id.startsWith(c.split+'-')) issue('id must agree with split');
  const anchors = new Set<string>();
  for (const g of c.expected_items) {
    if (!c.message.includes(g.anchor)) issue('gold anchor must be an exact substring of message');
    if (anchors.has(g.anchor)) issue('gold anchors must be distinct');
    anchors.add(g.anchor);
    if (g.clause_anchor && !c.brief.includes(g.clause_anchor)) issue('clause_anchor must be an exact substring of brief');
    if (g.label==='included' && (!g.clause_anchor || g.included_basis==='none')) issue('included gold needs a clause and basis');
    if (g.label!=='included' && g.included_basis!=='none') issue('non-included gold must have basis none');
  }
  for (const anchor of c.forbidden_included) if (!c.message.includes(anchor)) issue('forbidden anchor must occur in message');
  if (c.expect_injection && c.forbidden_included.length===0) issue('injection case must name forbidden text');
});
export async function loadCases(directory = fileURLToPath(new URL('./cases/', import.meta.url))):Promise<EvalCase[]> {
  const files = (await readdir(directory)).filter(f => /^(dev|test)-.*\.json$/.test(f)).sort();
  const cases = await Promise.all(files.map(async f => {
    const c = EvalCaseSchema.parse(JSON.parse(await readFile(join(directory,f),'utf8')));
    if (f!==c.id+'.json') throw new Error(`Case filename disagrees with id: ${f}`);
    return c;
  }));
  if (new Set(cases.map(c => c.id)).size!==cases.length) throw new Error('Duplicate case id');
  return cases;
}
