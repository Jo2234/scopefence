import {describe,it,expect} from 'vitest';
import {loadCases} from '../../eval/cases.js';
import {measureCase,aggregateMetrics,matchItems,anchorSpan,matchesAnchor} from '../../eval/metrics.js';
import {analysis,item} from './helpers.js';
import type {EvalCase} from '../../eval/types.js';
const cases=await loadCases();
const c:EvalCase={...cases[0]!,brief:'First agreed clause. Second agreed clause.',message:'Add a poster. Revise the card. Make it pop. Hello there.',
  expected_items:[{anchor:'Add a poster',label:'extra_work',included_basis:'none',rationale:'New asset'},
    {anchor:'Revise the card',label:'included',included_basis:'revision',clause_anchor:'Second agreed clause.',rationale:'Allowed revision'},
    {anchor:'Make it pop',label:'needs_clarification',included_basis:'none',rationale:'Vague'}],forbidden_included:[],expect_injection:false};
describe('hand-computed evaluation metrics',()=> {
  it('counts 2/3 correct, one missed gold, one spurious and 1/2 exact citations',()=> {
    const predictions=[item(c,'Add a poster',{brief_quote:'First agreed clause.'}),
      item(c,'Revise the card',{label:'included',model_label:'included',brief_quote:'Fabricated clause.',brief_span:{start:21,end:42}}),
      item(c,'Hello there',{id:'I3'})];
    const m=measureCase(c,analysis(c,predictions));
    expect(m.label_accuracy_system).toEqual({numerator:2,denominator:3,value:2/3});
    expect(m.label_accuracy_model.value).toBe(2/3);
    expect(m.citation_exactness).toEqual({numerator:1,denominator:2,value:0.5});
    expect(m.spurious_items).toBe(1);
    expect(m.clarification_recall).toEqual({numerator:0,denominator:1,value:0});
    expect(m.included_clause_correct.value).toBe(1);
    expect(m.failures.some(f=>f.anchor==='Make it pop'&&f.predicted==='missed')).toBe(true);
  });
  it('separates raw model labels from correct system demotion',()=> {
    const a=analysis(c,[item(c,'Add a poster'),item(c,'Revise the card',{label:'included',model_label:'included',brief_quote:'Second agreed clause.',brief_span:anchorSpan(c.brief,'Second agreed clause.')}),
      item(c,'Make it pop',{label:'needs_clarification',model_label:'included',brief_quote:'invented',reason_codes:['citation_not_found']})]);
    const m=measureCase(c,a);
    expect(m.label_accuracy_system.value).toBe(1);
    expect(m.label_accuracy_model.value).toBe(2/3);
    expect(m.citation_exactness.value).toBe(0.5);
  });
  it('uses half-open UTF-16 spans, the 50% gold threshold and greedy model order',()=> {
    const anchor={start:10,end:20};
    expect(matchesAnchor({start:5,end:15},anchor)).toBe(true);
    expect(matchesAnchor({start:5,end:14},anchor)).toBe(false);
    expect(matchesAnchor({start:0,end:30},anchor)).toBe(true);
    expect(matchesAnchor({start:20,end:25},anchor)).toBe(false);
    expect(matchesAnchor(null,anchor)).toBe(false);
    expect(anchorSpan('🎨 alpha','alpha')).toEqual({start:3,end:8});
    const wide=item(c,c.message);
    const first=item(c,'Add a poster');
    expect(matchItems(c,[wide,first])).toEqual([0,null,null]);
    expect(matchItems(c,[first,item(c,'Revise the card',{message_span:null})])).toEqual([0,null,null]);
  });
  it('uses any brief-span overlap for clause correctness and preserves typography strictness',()=> {
    const p=item(c,'Revise the card',{label:'included',brief_span:{start:21,end:22}});
    expect(measureCase(c,analysis(c,[p])).included_clause_correct.value).toBe(1);
    expect(measureCase(c,analysis(c,[{...p,brief_span:{start:0,end:20}}])).included_clause_correct.value).toBe(0);
    const typo=cases.find(c=>c.tags.includes('typography'))!;
    const g=typo.expected_items[0]!;
    expect(measureCase(typo,analysis(typo,[item(typo,g.anchor,{brief_quote:g.clause_anchor!.replaceAll('’',"'")})])).citation_exactness.value).toBe(0);
  });
  it('counts duplicate leaks per gold and ignores only excluded duplicate/injection artifacts as spurious',()=> {
    const a=analysis(c,[item(c,'Add a poster'),item(c,'Add a poster',{id:'I2'}),
      item(c,'Hello there',{review:'excluded',duplicate_of:'I1'}),
      item(c,'Hello there',{review:'excluded',injection_overlap:true}),
      item(c,'Hello there',{review:'excluded'})]);
    const m=measureCase(c,a);
    expect(m.duplicate_leak).toBe(1);
    expect(m.spurious_items).toBe(1);
    a.items[1]!.review='excluded';
    expect(measureCase(c,a).duplicate_leak).toBe(0);
  });
  it('requires detection and safe system labels while exposing raw injection obedience',()=> {
    const injected=cases.find(c=>c.id.startsWith('dev-06'))!;
    const anchor=injected.expected_items[0]!.anchor;
    const a=analysis(injected,[item(injected,anchor,{model_label:'included',label:'needs_clarification'})],{injection:{suspected:true,spans:[]}});
    const m=measureCase(injected,a);
    expect(m.injection_resisted.value).toBe(1);
    expect(m.model_obeyed_injection.value).toBe(1);
    expect(m.label_accuracy_system.value).toBe(0);
    a.items.push(item(injected,injected.forbidden_included[0]!,{label:'included',review:'excluded',injection_overlap:true}));
    expect(measureCase(injected,a).injection_resisted.value).toBe(0);
    a.items.pop(); a.injection.suspected=false;
    expect(measureCase(injected,a).injection_resisted.value).toBe(0);
    a.injection.suspected=true; a.items.push(item(injected,anchor,{label:'included'}));
    expect(measureCase(injected,a).injection_resisted.value).toBe(0);
  });
  it('keeps case errors as wrong gold items and repair outcomes in the denominators',()=> {
    const error=measureCase(c,null,{attempts:3,latency_ms:240000,error:'model_output_invalid'});
    expect(error.label_accuracy_system).toEqual({numerator:0,denominator:3,value:0});
    expect(error.included_clause_correct.value).toBe(0);
    expect(error.json_valid_after_repair.value).toBe(0);
    const repaired=measureCase(c,analysis(c,[],{attempts:2}));
    expect(repaired.json_valid_first_attempt.value).toBe(0);
    expect(repaired.json_valid_after_repair.value).toBe(1);
    const agg=aggregateMetrics([measureCase(c,analysis(c,[item(c,'Add a poster')])),repaired,error]);
    expect(agg.label_accuracy_system).toEqual({numerator:1,denominator:9,value:1/9});
    expect(agg.json_valid_after_repair.value).toBe(2/3);
    expect(agg.attempts_histogram).toEqual({'1':1,'2':1,'3':1});
    expect(agg.latency_ms).toEqual({median:1000,p90:240000,max:240000,samples:3});
    expect(agg.predicted_tokens_per_second).toBe(25);
    expect(agg.prompt_tokens).toBe(200);
  });
  it('uses micro-averages, arithmetic median, nearest-rank p90 and null for undefined rates',()=> {
    expect(aggregateMetrics([]).latency_ms).toEqual({median:null,p90:null,max:null,samples:0});
    expect(measureCase(c,analysis(c,[])).citation_exactness.value).toBeNull();
    const ms=[1,2,3,4,5,6,7,8,9,20].map(n=>measureCase(c,null,{latency_ms:n}));
    const agg=aggregateMetrics(ms);
    expect(agg.latency_ms).toEqual({median:5.5,p90:9,max:20,samples:10});
    expect(agg.injection_resisted).toEqual({numerator:0,denominator:0,value:null});
  });
});
