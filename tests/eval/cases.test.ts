import { describe, it, expect } from 'vitest';
import { loadCases, EvalCaseSchema } from '../../eval/cases.js';
import { RateCardSchema } from '../../src/domain/index.js';
const cases = await loadCases();
describe('frozen synthetic evaluation corpus', () => {
  it('contains exactly the planned 6 dev and 10 held-out scenarios', () => {
    expect(cases).toHaveLength(16);
    expect(cases.filter(c=>c.split==='dev')).toHaveLength(6);
    expect(cases.filter(c=>c.split==='test')).toHaveLength(10);
    for(const tag of ['negation','ambiguity','duplicate','out_of_brief','injection','partial_match','revision_allowance','typography'])
      expect(cases.some(c=>c.tags.includes(tag)),tag).toBe(true);
  });
  for(const c of cases) it(`${c.id}: exact evidence, synthetic provenance and valid rate card`,()=> {
    expect(c.synthetic).toBe(true);
    expect(c.note).toBe('Invented example for testing; not a real client or project.');
    expect(EvalCaseSchema.safeParse(c).success).toBe(true);
    expect(RateCardSchema.safeParse(c.rate_card).success).toBe(true);
    // Lead-directed removal of test-05's exclusion line leaves its five agreed-brief lines intact.
    if(c.id==='test-05-signature-injection') expect(c.brief.split('\n')).toHaveLength(5);
    else expect(c.brief.split('\n').length).toBeGreaterThanOrEqual(6);
    expect(c.brief.split('\n').length).toBeLessThanOrEqual(20);
    for(const email of (c.brief+' '+c.message).match(/[\w.+-]+@[\w.-]+\.[a-z]+/gi)??[]) expect(email.endsWith('@example.com')).toBe(true);
    for(const g of c.expected_items) {
      expect(c.message.includes(g.anchor)).toBe(true);
      expect(c.message.indexOf(g.anchor)).toBe(c.message.lastIndexOf(g.anchor));
      if(g.clause_anchor) expect(c.brief.includes(g.clause_anchor)).toBe(true);
      expect(g.rationale.trim().length).toBeGreaterThan(20);
    }
  });
  it('rejects corrupted evidence, basis, currency and duplicate rate ids',()=> {
    const c=structuredClone(cases[0]!);
    expect(EvalCaseSchema.safeParse({...c,expected_items:[{...c.expected_items[0],anchor:'invented absent text'}]}).success).toBe(false);
    expect(EvalCaseSchema.safeParse({...c,expected_items:[{...c.expected_items[0],clause_anchor:undefined}]}).success).toBe(false);
    expect(RateCardSchema.safeParse({...c.rate_card,currency:'BTC'}).success).toBe(false);
    expect(RateCardSchema.safeParse({...c.rate_card,effort_hours:{...c.rate_card.effort_hours,s:0.123}}).success).toBe(false);
    expect(RateCardSchema.safeParse({...c.rate_card,deliverables:[c.rate_card.deliverables[0],c.rate_card.deliverables[0]]}).success).toBe(false);
  });
  it('keeps test-02 and test-05 extras without explicit exclusions after lead realism review',()=> {
    for(const id of ['test-02-out-of-brief','test-05-signature-injection']) {
      const c=cases.find(c=>c.id===id)!;
      expect(c.brief).not.toContain('Out of scope:');
      expect(c.expected_items.map(g=>g.label)).toEqual(['extra_work']);
      expect(c.expected_items[0]!.rationale).not.toMatch(/explicitly excluded/i);
    }
  });
  it('freezes deliberate label decisions rather than confusing scope with price',()=> {
    const get=(id:string)=>cases.find(c=>c.id.startsWith(id))!;
    expect(get('test-06').rate_card.revision_rounds_used).toBe(2);
    expect(get('test-06').expected_items.map(g=>[g.label,g.included_basis])).toEqual([['included','revision']]);
    expect(get('test-03').expected_items.map(g=>g.label)).toEqual(['extra_work','extra_work']);
    expect(get('test-04').expected_items.map(g=>g.label)).toEqual(['needs_clarification']);
    expect(get('test-08').expected_items).toHaveLength(1);
    expect(get('dev-05').expected_items).toHaveLength(1);
    expect(get('test-10').brief).toMatch(/[“”’]/);
    expect(get('test-10').brief).toContain('–');
    for(const c of cases.filter(c=>c.tags.includes('negation'))) for(const g of c.expected_items)
      expect(c.forbidden_included).not.toContain(g.anchor);
  });
});
it('validates every rate card with the product RateCardSchema',()=> {
  for(const c of cases) expect(RateCardSchema.safeParse(c.rate_card).success,c.id).toBe(true);
});
