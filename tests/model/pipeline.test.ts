import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {it,expect} from 'vitest';
import {analyse} from '../../src/model/analyse.js';
import {ScriptedAdapter} from '../../src/model/scripted.js';
import {FixtureAdapter,fixtureKey} from '../../src/model/fixture.js';
import {type CompletionRequest,AdapterError} from '../../src/model/adapter.js';
import {AnalysisSchema,RateCardSchema} from '../../src/domain/index.js';
import demo from '../../fixtures/demo/demo-1.json' with {type:'json'};
const card=RateCardSchema.parse(demo.rate_card);
it('hashes original inputs, truncates prompt text, and verifies citations against the full brief',async()=>{
 const brief='x'.repeat(8000)+'\nAn additional agreed clause.';
 const message='Please add that work.';
 const raw=JSON.stringify({items:[{message_quote:message,request:'Agreed work',clause_id:'none',brief_quote:'An additional agreed clause.',label:'included',included_basis:'deliverable',reason:'The agreement covers it.',question:'',deliverable_id:'none',effort:'none'}]});
 const adapter=new ScriptedAdapter([raw]);
 const result=await analyse({brief,message,rate_card:card},adapter);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);
 expect(result.analysis.reference).toBe('SF-'+createHash('sha256').update(brief+'\u0000'+message+'\u0000'+JSON.stringify(card)).digest('hex').slice(0,8));
 expect(result.analysis.input.brief).toHaveLength(8000);expect(result.analysis.truncated.brief_dropped_chars).toBe(29);
 expect(adapter.requests[0]!.user).not.toContain('An additional agreed clause.');
 expect(result.analysis.items[0]).toMatchObject({label:'included',citation_status:'verified',brief_span:{start:8001,end:8029},review:'proposed'});
 expect(result.analysis.warnings).toContainEqual(expect.objectContaining({code:'truncated_input'}));expect(AnalysisSchema.safeParse(result.analysis).success).toBe(true);
});
it('keeps last-attempt timings/raw text and uses wall time rather than reported adapter latency',async()=>{
 class Timed extends ScriptedAdapter{override async complete(req:CompletionRequest){const result=await super.complete(req);return {...result,latency_ms:999999,timings:{prompt_tokens:this.requests.length,predicted_tokens:7,prompt_ms:2,predicted_ms:3}};}}
 const result=await analyse({...demo,rate_card:card},new Timed(['invalid','{"items":[]}']));expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);
 expect(result.analysis.timings).toEqual({prompt_tokens:2,predicted_tokens:7,prompt_ms:2,predicted_ms:3});expect(result.analysis.raw_model_output).toBe('{"items":[]}');expect(result.analysis.latency_ms).toBeLessThan(999999);
});
it('caps repairs at three and honours a smaller attempt budget',async()=>{
 for(const max_attempts of [1,99]){const adapter=new ScriptedAdapter(['bad','bad','bad','should not be used']);const result=await analyse({...demo,rate_card:card},adapter,{max_attempts});expect(result).toMatchObject({ok:false,error:{code:'model_output_invalid',attempts:max_attempts===1?1:3}});expect(adapter.requests).toHaveLength(max_attempts===1?1:3);}
});
it('does not call the model for an already-aborted operation',async()=>{const controller=new AbortController();controller.abort();const adapter=new ScriptedAdapter(['{"items":[]}']);expect(await analyse({...demo,rate_card:card},adapter,{signal:controller.signal})).toMatchObject({ok:false,error:{code:'cancelled'}});expect(adapter.requests).toHaveLength(0);});
it('binds fixture lookup to the analysed text rather than the full original text',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'scopefence-pipeline-'));
 try{const brief='x'.repeat(8000)+'EXTRA';const key=fixtureKey('x'.repeat(8000),demo.message);await writeFile(path.join(directory,`${key}.json`),JSON.stringify({key,provenance:'hand-written test fixture',model_id:'gemma-4-e2b',prompt_version:'pv1',raw_text:'{"items":[]}',synthetic_input:true}));
 const result=await analyse({...demo,brief,rate_card:card},new FixtureAdapter(directory));expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);expect(result.analysis.model.provenance).toBe('hand-written test fixture');expect(result.analysis.input.brief).toHaveLength(8000);
 }finally{await rm(directory,{recursive:true,force:true});}
});
it('turns an adapter timeout into a failure without repair calls',async()=>{const adapter=new ScriptedAdapter([new AdapterError('model_timeout'),'unused']);expect(await analyse({...demo,rate_card:card},adapter)).toMatchObject({ok:false,error:{code:'model_timeout'}});expect(adapter.requests).toHaveLength(1);});
it('reports the clause cap even when no characters were truncated',async()=>{const brief=Array.from({length:121},(_,i)=>`Clause ${i+1}.`).join('\n');const result=await analyse({...demo,brief,rate_card:card},new ScriptedAdapter(['{"items":[]}']));expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);expect(result.analysis.clauses).toHaveLength(120);expect(result.analysis.truncated.brief).toBe(false);expect(result.analysis.warnings).toContainEqual({code:'truncated_input',message:'Only the first 120 brief clauses were analysed.'});});
