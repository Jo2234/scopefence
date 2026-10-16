import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { loadCases } from '../../eval/cases.js';
import { getModel } from '../../src/model/models.js';
import { parseArgs, runEvaluation, verifyModelIdentity, streamSha256, loadBindings, cannedOutput, main, EvalSetupError } from '../../eval/run.js';
import type { Adapter, Bindings } from '../../eval/run.js';
import { analysis, item } from './helpers.js';
const cases=(await loadCases()).slice(0,2);
const folders:string[]=[];
async function temp() {const p=await mkdtemp(join(tmpdir(),'scopefence-eval-'));folders.push(p);return p;}
afterEach(async()=>{await Promise.all(folders.splice(0).map(p=>rm(p,{recursive:true,force:true})));vi.restoreAllMocks();});
/** Runner dependency harness only. The real analyse + ScriptedAdapter test below
 * stays TODO until slot 1 lands; this does not claim reconciliation integration. */
function harness():Bindings {
  class Queue implements Adapter {
    readonly mode='fixture' as const;
    constructor(private queue:string[]) {}
    async health() {return {status:'ready' as const,model_file:null};}
    async complete() {const text=this.queue.shift();if(text===undefined) throw new Error('Empty scripted queue');return {text,latency_ms:0,timings:null,model_file:null};}
  }
  class NeverLive extends Queue {constructor() {super([]);throw new Error('Dry-run attempted a live adapter');}}
  return {
    PROMPT_VERSION:'test-prompt',ScriptedAdapter:Queue,LlamaServerAdapter:NeverLive,
    async analyse(input,adapter) {
      const c=cases.find(c=>c.message===input.message)!;
      const output=await adapter.complete({system:'',user:'',json_schema:{},max_tokens:1100,temperature:0,seed:42});
      const raw=JSON.parse(output.text) as {items:{message_quote:string;label:'included'|'extra_work';brief_quote:string}[]};
      return {ok:true,analysis:analysis(c,raw.items.map((p,i)=>item(c,p.message_quote,{id:`I${i+1}`,label:p.label,model_label:p.label,brief_quote:p.brief_quote})),{raw_model_output:output.text})};
    },
  };
}
describe('evaluation CLI and offline runner orchestration',()=> {
  it('parses the documented flags, rejects invalid or missing values',()=> {
    expect(parseArgs(['--','--model','gemma-4-e2b','--split','dev','--case',cases[0]!.id,'--dry-run','--out','tmp']))
      .toEqual({model:'gemma-4-e2b',split:'dev',caseIds:[cases[0]!.id],dryRun:true,out:'tmp'});
    for(const args of [[],['--model'],['--model','gemma-4-e2b','--split','wrong'],['--wat'],['--out','--dry-run']]) expect(()=>parseArgs(args)).toThrow(EvalSetupError);
  });
  it('dry-runs two cases serially, uses the scripted queue and saves raw output plus metadata without any network or hash access',async()=> {
    const bindings=harness();
    const original=bindings.analyse;
    let active=0,maxActive=0;
    bindings.analyse=vi.fn(async(...args:Parameters<Bindings['analyse']>)=> {
      active++;maxActive=Math.max(maxActive,active);
      await new Promise(resolve=>setTimeout(resolve,5));
      try {return await original(...args);} finally {active--;}
    });
    const fetcher=vi.fn<typeof fetch>(()=>{throw new Error('Unexpected network');});
    const hashFile=vi.fn(async()=>{throw new Error('Unexpected model file read');});
    const out=await temp();
    const run=await runEvaluation({model:'gemma-4-e2b',split:'dev',caseIds:cases.map(c=>c.id),out,dryRun:true},{bindings,cases,fetcher,hashFile});
    expect(fetcher).not.toHaveBeenCalled();expect(hashFile).not.toHaveBeenCalled();
    expect(maxActive).toBe(1);expect(bindings.analyse).toHaveBeenCalledTimes(2);
    expect(run.result.cases.map(c=>c.id)).toEqual(cases.map(c=>c.id));
    expect(run.result.dry_run).toBe(true);
    expect(run.path).toContain('/dry-run/');
    expect(run.result.metadata.git_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(run.result.metadata.cases_git_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(run.result.metadata.verified_sha256).toBeNull();
    expect(run.result.aggregate.label_accuracy_system).toEqual({numerator:2,denominator:2,value:1});
    const saved=JSON.parse(await readFile(run.path,'utf8'));
    expect(saved).toEqual(run.result);
    expect(saved.cases[0].analysis.raw_model_output).toContain('Hand-written test fixture');
    expect(saved.cases[0].analysis.model.provenance).toContain('dry-run only');
  });
  it('continues after a per-case invalid output, retaining raw error and wrong gold denominator',async()=> {
    const bindings=harness(),original=bindings.analyse;
    let calls=0;
    bindings.analyse=async(...args:Parameters<Bindings['analyse']>)=>++calls===1?{ok:false,error:{code:'model_output_invalid',message:'Three invalid replies',attempts:3,raw:'invalid raw'}}:original(...args);
    const {result}=await runEvaluation({model:'gemma-4-e2b',split:'dev',out:await temp(),dryRun:true},{bindings,cases});
    expect(calls).toBe(2);
    expect(result.cases[0]!.error?.code).toBe('model_output_invalid');
    expect(result.cases[0]!.raw_model_output).toBe('invalid raw');
    expect(result.cases[1]!.analysis).not.toBeNull();
    expect(result.aggregate.label_accuracy_system).toEqual({numerator:1,denominator:2,value:0.5});
    expect(result.aggregate.attempts_histogram).toEqual({'1':1,'3':1});
  });
  it('rejects unknown registry slugs and mismatched case/split before analysis',async()=> {
    const bindings=harness();bindings.analyse=vi.fn(bindings.analyse);
    await expect(runEvaluation({model:'unknown',split:'dev',dryRun:true},{bindings,cases})).rejects.toThrow('Unknown model');
    await expect(runEvaluation({model:'runtime',split:'dev',dryRun:true},{bindings,cases})).rejects.toThrow('Unknown model');
    await expect(runEvaluation({model:'gemma-4-e2b',split:'dev',caseIds:['test-01'],dryRun:true},{bindings,cases})).rejects.toThrow('No cases selected');
    expect(bindings.analyse).not.toHaveBeenCalled();
  });
  it('verifies server identity before hashing and fails closed on mismatch, missing props or HTTP failure',async()=> {
    const hashFile=vi.fn(async()=>'abc');
    const model={file:'expected.gguf',sha256:'abc'};
    const wrong=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({model_path:'/tmp/other.gguf'})));
    await expect(verifyModelIdentity(model,'/cache',wrong,hashFile)).rejects.toThrow('Loaded model mismatch');
    expect(hashFile).not.toHaveBeenCalled();
    const missing=vi.fn<typeof fetch>(async()=>new Response('{}'));
    await expect(verifyModelIdentity(model,'/cache',missing,hashFile)).rejects.toThrow('no model_path');
    const busy=vi.fn<typeof fetch>(async()=>new Response('',{status:503}));
    await expect(verifyModelIdentity(model,'/cache',busy,hashFile)).rejects.toThrow('HTTP 503');
  });
  it('hashes once before a run and aborts before analysing a corrupted model',async()=> {
    const model={file:'expected.gguf',sha256:'abc'};
    const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({model_path:'/cache/models/expected.gguf'})));
    const hashFile=vi.fn(async()=>'wrong');
    await expect(verifyModelIdentity(model,'/cache',fetcher,hashFile)).rejects.toThrow('SHA256 mismatch');
    expect(hashFile).toHaveBeenCalledExactlyOnceWith('/cache/models/expected.gguf');
    const bindings=harness();bindings.analyse=vi.fn(bindings.analyse);
    await expect(runEvaluation({model:'gemma-4-e2b',split:'dev'},{bindings,cases,cacheDir:'/cache',fetcher,hashFile})).rejects.toThrow('Loaded model mismatch');
    expect(bindings.analyse).not.toHaveBeenCalled();
  });
  it('checks the registered hash exactly once before two serial analyses using offline stubs',async()=> {
    const model=getModel('gemma-4-e2b')!;
    const trace:string[]=[];
    const fetcher=vi.fn<typeof fetch>(async()=>{trace.push('props');return new Response(JSON.stringify({model_path:'/cache/models/'+model.file,build_info:'offline stub build'}));});
    const hashFile=vi.fn(async()=>{trace.push('hash');return model.sha256;});
    const bindings=harness(),original=bindings.analyse;
    class StubLive implements Adapter {
      readonly mode='live' as const;
      queue=cases.map(cannedOutput);
      async health() {return {status:'ready' as const,model_file:model.file};}
      async complete() {return {text:this.queue.shift()!,latency_ms:0,timings:null,model_file:model.file};}
    }
    bindings.LlamaServerAdapter=StubLive;
    bindings.analyse=async(...args)=> {
      trace.push('analyse');
      const r=await original(...args);
      if(r.ok) {r.analysis.mode='live';r.analysis.model.file=model.file;}
      return r;
    };
    const {result}=await runEvaluation({model:model.slug,split:'dev',out:await temp()},{bindings,cases,cacheDir:'/cache',fetcher,hashFile});
    expect(trace).toEqual(['props','hash','analyse','analyse']);
    expect(hashFile).toHaveBeenCalledExactlyOnceWith('/cache/models/'+model.file);
    expect(result.metadata.verified_sha256).toBe(model.sha256);
    expect(result.cases.every(c=>!c.error)).toBe(true);
  });
  it('rejects non-object props and prevents hashing a different file with the same basename',async()=> {
    const hashFile=vi.fn(async()=>'abc');
    const model={file:'expected.gguf',sha256:'abc'};
    const nullProps=vi.fn<typeof fetch>(async()=>new Response('null'));
    await expect(verifyModelIdentity(model,'/cache',nullProps,hashFile)).rejects.toThrow('Expected an object');
    const otherPath=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({model_path:'/other/models/expected.gguf'})));
    await expect(verifyModelIdentity(model,'/cache',otherPath,hashFile)).rejects.toThrow('Loaded model path mismatch');
    expect(hashFile).not.toHaveBeenCalled();
  });
  it('streams a file hash against a known independent SHA256 vector',async()=> {
    const path=join(await temp(),'sample');await writeFile(path,'abc');
    expect(await streamSha256(path)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('returns exit 2 and a clear message on CLI setup errors',async()=> {
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    expect(await main(['--model','not-registered','--split','dev','--dry-run'])).toBe(2);
    expect(log).toHaveBeenCalledWith('Unknown model slug: not-registered');
  });
});
const modules=['analyse.ts','llama-server.ts','scripted.ts','prompt.ts'];
if(modules.every(f=>existsSync(new URL('../../src/model/'+f,import.meta.url)))&&existsSync(new URL('../../src/domain/index.ts',import.meta.url))) {
  it('runs two dry-run cases through the real analyse and ScriptedAdapter without llama-server',async()=> {
    const bindings=await loadBindings();
    const {result}=await runEvaluation({model:'gemma-4-e2b',split:'dev',caseIds:cases.map(c=>c.id),dryRun:true,out:await temp()},{bindings,cases});
    expect(result.cases.every(c=>c.error===null)).toBe(true);
    expect(result.aggregate.label_accuracy_system).toEqual({numerator:2,denominator:2,value:1});
    expect(result.cases[0]!.analysis!.items[0]!.citation_status).toBe('verified');
    expect(result.cases[0]!.analysis!.items[0]!.included_basis).toBe('revision');
    expect(result.cases[1]!.analysis!.items[0]!.label).toBe('extra_work');
  });
} else it.todo('run two dry-run cases through the real analyse + ScriptedAdapter after slot 1 and slot 2 modules land');
