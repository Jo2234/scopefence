import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cpus, totalmem, platform, release, arch, loadavg } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getModel } from '../src/model/models.js';
import { loadCases } from './cases.js';
import { measureCase, aggregateMetrics } from './metrics.js';
import type { AggregateMetrics, CaseMetrics } from './metrics.js';
import type { Analysis, RateCard } from '../src/domain/index.js';
import type { ModelAdapter } from '../src/model/adapter.js';
import type { CaseError, EvalCase } from './types.js';

const execFileAsync=promisify(execFile);
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
const LLM_URL='http://127.0.0.1:8089';
export class EvalSetupError extends Error { readonly exitCode=2; }
export interface Options { model:string; split:'dev'|'test'|'all'; caseIds?:string[]; out?:string; dryRun?:boolean }
export function parseArgs(args:string[]):Options {
  let model:string|undefined,split:Options['split']|undefined,out:string|undefined,dryRun=false;
  const caseIds:string[]=[];
  for(let i=0;i<args.length;i++) {
    const arg=args[i]!;
    if(arg==='--') continue;
    if(arg==='--dry-run') {dryRun=true;continue;}
    if(!['--model','--split','--case','--out'].includes(arg)) throw new EvalSetupError(`Unknown argument: ${arg}`);
    const value=args[++i];
    if(!value||value.startsWith('--')) throw new EvalSetupError(`Missing value for ${arg}`);
    if(arg==='--model') model=value;
    if(arg==='--split') {
      if(!['dev','test','all'].includes(value)) throw new EvalSetupError('--split must be dev, test or all');
      split=value as Options['split'];
    }
    if(arg==='--out') out=value;
    if(arg==='--case') caseIds.push(value);
  }
  if(!model||!split) throw new EvalSetupError('Usage: pnpm eval -- --model <slug> --split dev|test|all [--case <id>] [--out eval/results] [--dry-run]');
  return {model,split,caseIds,out,dryRun};
}
export type Adapter = ModelAdapter;
export interface Bindings {
  analyse(input:{brief:string;message:string;rate_card:RateCard},adapter:Adapter,opts?:{signal?:AbortSignal;max_attempts?:number}):Promise<{ok:true;analysis:Analysis}|{ok:false;error:CaseError}>;
  LlamaServerAdapter:new(url:string)=>Adapter;
  ScriptedAdapter:new(queue:string[])=>Adapter;
  PROMPT_VERSION:string;
}
/** Load the model pipeline only when running cases; integrity/metrics/report stay independent. */
export async function loadBindings():Promise<Bindings> {
  try {
    const [a,l,s,p]=await Promise.all(['analyse.ts','llama-server.ts','scripted.ts','prompt.ts'].map(f=>import(new URL('../src/model/'+f,import.meta.url).href)));
    if(typeof a.analyse!=='function'||typeof l.LlamaServerAdapter!=='function'||typeof s.ScriptedAdapter!=='function'||typeof p.PROMPT_VERSION!=='string')
      throw new Error('Missing §4.10 model exports');
    return {analyse:a.analyse,LlamaServerAdapter:l.LlamaServerAdapter,ScriptedAdapter:s.ScriptedAdapter,PROMPT_VERSION:p.PROMPT_VERSION};
  } catch(error) { throw new EvalSetupError(`Evaluation requires slot 1 model modules (analyse, llama-server, scripted, prompt): ${error instanceof Error?error.message:String(error)}`); }
}
export async function streamSha256(path:string):Promise<string> {
  const hash=createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}
export async function verifyModelIdentity(model:{file:string;sha256:string},cache:string,fetcher:typeof fetch=fetch,hashFile=streamSha256) {
  let props:Record<string,unknown>;
  try {
    const response=await fetcher(LLM_URL+'/props',{signal:AbortSignal.timeout(2000)});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const json:unknown=await response.json();
    if(json===null||typeof json!=='object'||Array.isArray(json)) throw new Error('Expected an object from /props');
    props=json as Record<string,unknown>;
  } catch(error) {throw new EvalSetupError(`Cannot verify llama-server at ${LLM_URL}/props: ${error instanceof Error?error.message:String(error)}`);}
  const path=props.model_path;
  if(typeof path!=='string'||basename(path)!==model.file)
    throw new EvalSetupError(`Loaded model mismatch: requested ${model.file}; /props reports ${typeof path==='string'?path:'no model_path'}. Start the registered model before evaluating.`);
  const modelPath=resolve(cache,'models',model.file);
  if(isAbsolute(path) && resolve(path)!==modelPath)
    throw new EvalSetupError(`Loaded model path mismatch: /props reports ${path}, but the file to hash is ${modelPath}. Use the same verified cache for the server and eval.`);
  let actual:string;
  try {actual=await hashFile(modelPath);} catch(error) {throw new EvalSetupError(`Cannot hash registered model ${modelPath}: ${error instanceof Error?error.message:String(error)}`);}
  if(actual!==model.sha256) throw new EvalSetupError(`SHA256 mismatch for ${model.file}: expected ${model.sha256}; got ${actual}. No cases were run.`);
  return {props,verified_sha256:actual};
}
async function gitOutput(args:string[]):Promise<string|null> {
  try {return (await execFileAsync('git',['-C',repoRoot,...args])).stdout.trim()||null;} catch {return null;}
}
async function serverFlags():Promise<string[]|null> {
  try {
    const pids=(await execFileAsync('pgrep',['-x','llama-server'])).stdout.trim().split(/\s+/);
    if(pids.length!==1||!/^\d+$/.test(pids[0]!)) return null;
    const command=(await execFileAsync('ps',['-p',pids[0]!,'-o','command='])).stdout.trim();
    const marker=command.indexOf('llama-server');
    return marker>=0?command.slice(marker+'llama-server'.length).trim().split(/\s+/):null;
  } catch {return null;}
}
/** Match the launch receipt to its live executable before using exact argv or version. */
async function runtimeMetadata(cache:string|undefined):Promise<{flags:string[]|null;build:string|null}> {
  const fallback={flags:await serverFlags(),build:null};
  if(!cache) return fallback;
  let receipt:{pid:number;binary:string;flags:string[]};
  try {receipt=JSON.parse(await readFile(join(cache,'run/server.json'),'utf8'));}
  catch {return fallback;}
  try {
    const executable=(await execFileAsync('ps',['-p',String(receipt.pid),'-o','comm='])).stdout.trim();
    if(resolve(executable)!==resolve(receipt.binary)||basename(executable)!=='llama-server') return fallback;
    if(!Array.isArray(receipt.flags)||!receipt.flags.every(f=>typeof f==='string')) return fallback;
    const runtime=getModel('runtime')!;
    const archive=join(cache,'runtime','llama-b11687',runtime.file);
    if(await streamSha256(archive)!==runtime.sha256) throw new EvalSetupError('Runtime archive hash mismatch; cannot record a trusted build');
    const version=await execFileAsync(receipt.binary,['--version'],{timeout:10000});
    return {flags:receipt.flags,build:[version.stdout.trim(),version.stderr.trim()].filter(Boolean).join('\n')};
  } catch(error) {
    if(error instanceof EvalSetupError) throw error;
    throw new EvalSetupError(`Cannot record the running llama.cpp version: ${error instanceof Error?error.message:String(error)}`);
  }
}
/** Explicitly gold-derived canned output; exercises wiring only, never model quality. */
export function cannedOutput(c:EvalCase):string {
  const clauses=c.brief.split('\n').filter(line=>line.trim()).map(line=>line.trim());
  return JSON.stringify({items:c.expected_items.map(g=> {
    const clauseIndex=g.clause_anchor?clauses.findIndex(line=>line.includes(g.clause_anchor!)):-1;
    const fixed=c.rate_card.deliverables.find(d=>g.anchor.toLowerCase().includes(d.name.toLowerCase()));
    return {message_quote:g.anchor,request:g.anchor.slice(0,140),clause_id:clauseIndex<0?'none':`C${clauseIndex+1}`,
      brief_quote:g.clause_anchor??'',label:g.label,included_basis:g.included_basis,reason:'Hand-written test fixture; not a live model result.',
      question:g.label==='needs_clarification'?'What exact change and quantity do you want?':'',
      deliverable_id:g.label==='extra_work'?(fixed?.id??'custom'):'none',effort:g.label==='extra_work'||g.included_basis==='revision'?'s':'none'};
  })});
}
/** Native os.loadavg order: 1, 5 and 15 minutes. Keep full precision in JSON. */
export type LoadAverage = [one_minute:number,five_minutes:number,fifteen_minutes:number];
export interface CaseMachineLoad {before:LoadAverage;after:LoadAverage}
export interface RunMachineLoad {
  periods_minutes:[1,5,15];sample_count:number;min:LoadAverage;median:LoadAverage;max:LoadAverage;
}
function summarizeMachineLoad(samples:LoadAverage[]):RunMachineLoad {
  const columns=[0,1,2].map(i=>samples.map(s=>s[i]!).sort((a,b)=>a-b));
  const n=samples.length;
  return {periods_minutes:[1,5,15],sample_count:n,
    min:columns.map(c=>c[0]!) as LoadAverage,
    median:columns.map(c=>n%2?c[Math.floor(n/2)]!:(c[n/2-1]!+c[n/2]!)/2) as LoadAverage,
    max:columns.map(c=>c[n-1]!) as LoadAverage};
}
export interface CaseResult {
  id:string;split:'dev'|'test';title:string;tags:string[];
  expected_items:EvalCase['expected_items'];forbidden_included:string[];expect_injection:boolean;
  analysis:Analysis|null;error:CaseError|null;raw_model_output:string|null;wall_ms:number;metrics:CaseMetrics;
  // Absent in historical result files; every new run records both samples.
  machine_load?:CaseMachineLoad;
}
export interface RunResult {
  schema_version:1;synthetic:true;note:string;dry_run:boolean;
  metadata:{
    git_sha:string|null;cases_git_sha:string|null;prompt_version:string;model_slug:string;model_file:string;model_sha256:string;verified_sha256:string|null;
    llama_cpp_build:string|null;expected_llama_cpp_build:string;server_flags:string[]|null;
    cpu_brand:string;ram_bytes:number;os:string;node_version:string;start_utc:string;end_utc:string;
    other_heavy_processes:string|null;split:Options['split'];case_ids:string[];provenance:string;
  };
  cases:CaseResult[];aggregate:AggregateMetrics;by_split:Partial<Record<'dev'|'test',AggregateMetrics>>;
  machine_load?:RunMachineLoad;
}
export interface RunDependencies {
  bindings?:Bindings;cases?:EvalCase[];
  // Test-only dependency injection for identity guards, never a CLI bypass.
  fetcher?:typeof fetch;hashFile?:typeof streamSha256;cacheDir?:string;
  onCaseComplete?:(result:CaseResult)=>void;
  readLoadAverage?:()=>LoadAverage;
}
export async function runEvaluation(options:Options,deps:RunDependencies={}):Promise<{path:string;result:RunResult}> {
  const entry=getModel(options.model);
  if(!entry||entry.slug==='runtime') throw new EvalSetupError(`Unknown model slug: ${options.model}`);
  const all=deps.cases??await loadCases();
  const selected=all.filter(c=>(options.split==='all'||c.split===options.split)&&(!options.caseIds?.length||options.caseIds.includes(c.id)));
  if(!selected.length) throw new EvalSetupError('No cases selected');
  for(const id of options.caseIds??[]) if(!selected.some(c=>c.id===id)) throw new EvalSetupError(`Case ${id} is unknown or not in split ${options.split}`);
  const start=new Date().toISOString();
  let identity:Awaited<ReturnType<typeof verifyModelIdentity>>|null=null;
  if(!options.dryRun) {
    const cache=deps.cacheDir??process.env.SCOPEFENCE_CACHE_DIR;
    if(!cache) throw new EvalSetupError('Set SCOPEFENCE_CACHE_DIR to the verified model cache before live evaluation');
    identity=await verifyModelIdentity(entry,cache,deps.fetcher,deps.hashFile);
  }
  const bindings=deps.bindings??await loadBindings();
  const [git_sha,cases_git_sha,runtime]=await Promise.all([gitOutput(['rev-parse','HEAD']),gitOutput(['log','-1','--format=%H','--','eval/cases']),options.dryRun?Promise.resolve({flags:null,build:null}):runtimeMetadata(deps.cacheDir??process.env.SCOPEFENCE_CACHE_DIR)]);
  if(!git_sha||!cases_git_sha) throw new EvalSetupError('Evaluation requires committed cases and a git HEAD so labels can be traced');
  const live=options.dryRun?null:new bindings.LlamaServerAdapter(LLM_URL);
  const results:CaseResult[]=[];
  const readLoadAverage=deps.readLoadAverage??(()=>loadavg() as LoadAverage);
  const loadSamples:LoadAverage[]=[];
  for(const c of selected) {
    const loadBefore=[...readLoadAverage()] as LoadAverage;
    const before=performance.now();
    let analysis:Analysis|null=null,error:CaseError|null=null;
    try {
      const adapter=options.dryRun?new bindings.ScriptedAdapter([cannedOutput(c)]):live!;
      const outcome=await bindings.analyse({brief:c.brief,message:c.message,rate_card:c.rate_card},adapter);
      if(outcome.ok) analysis=outcome.analysis; else error=outcome.error;
    } catch(e) {
      error={code:'internal',message:e instanceof Error?e.message:String(e)};
    }
    const wall_ms=Math.max(0,Math.round(performance.now()-before));
    const loadAfter=[...readLoadAverage()] as LoadAverage;
    loadSamples.push(loadBefore,loadAfter);
    if(analysis && !options.dryRun && (!analysis.model.file||basename(analysis.model.file)!==entry.file))
      throw new EvalSetupError(`Model identity changed during ${c.id}: expected ${entry.file}, got ${analysis.model.file}. Run aborted; no results saved.`);
    if(analysis && options.dryRun) {
      // The ScriptedAdapter is fixture-only; attach explicit provenance to saved smoke results.
      analysis={...analysis,model:{...analysis.model,provenance:'hand-written test fixture (gold-derived canned output; dry-run only)'}};
    }
    const metrics=measureCase(c,analysis,{latency_ms:wall_ms,attempts:error?.attempts,error:error?`${error.code}: ${error.message}`:undefined});
    results.push({id:c.id,split:c.split,title:c.title,tags:c.tags,expected_items:c.expected_items,forbidden_included:c.forbidden_included,expect_injection:c.expect_injection,
      analysis,error,raw_model_output:analysis?.raw_model_output??error?.raw??null,wall_ms,metrics,machine_load:{before:loadBefore,after:loadAfter}});
    deps.onCaseComplete?.(results[results.length-1]!);
  }
  const by_split:RunResult['by_split']={};
  for(const split of ['dev','test'] as const) {
    const ms=results.filter(c=>c.split===split).map(c=>c.metrics);
    if(ms.length) by_split[split]=aggregateMetrics(ms);
  }
  const build=identity?.props.build_info??identity?.props.build;
  const result:RunResult={schema_version:1,synthetic:true,note:'Invented example for testing; not a real client or project.',dry_run:options.dryRun??false,
    metadata:{git_sha,cases_git_sha,prompt_version:bindings.PROMPT_VERSION,model_slug:entry.slug,model_file:entry.file,model_sha256:entry.sha256,
      verified_sha256:identity?.verified_sha256??null,llama_cpp_build:typeof build==='string'?build:build?JSON.stringify(build):runtime.build,
      expected_llama_cpp_build:'llama.cpp b11687',server_flags:runtime.flags,cpu_brand:cpus()[0]?.model??'unknown',ram_bytes:totalmem(),os:`${platform()} ${release()} ${arch()}`,node_version:process.version,
      start_utc:start,end_utc:new Date().toISOString(),other_heavy_processes:null,split:options.split,case_ids:results.map(c=>c.id),
      provenance:options.dryRun?'hand-written test fixture; offline plumbing check only':'live llama-server; model hash checked once before serial cases'},
    cases:results,aggregate:aggregateMetrics(results.map(c=>c.metrics)),by_split,machine_load:summarizeMachineLoad(loadSamples)};
  const utc=start.replaceAll(/[-:.]/g,'');
  // Dry runs never enter the live result set read by eval:report.
  const directory=resolve(options.out??join(repoRoot,'eval/results'),options.dryRun?'dry-run':'.');
  await mkdir(directory,{recursive:true});
  const path=join(directory,`${entry.slug}-${options.split}-${utc}.json`);
  // Atomic exclusive link prevents both partial JSON and replacement of an earlier run.
  const temp=path+`.${process.pid}.tmp`;
  await writeFile(temp,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  try {await link(temp,path);} finally {await unlink(temp);}
  return {path,result};
}
export async function main(args=process.argv.slice(2)):Promise<number> {
  try {
    const {path,result}=await runEvaluation(parseArgs(args),{onCaseComplete:c=>console.log(`${c.id}: ${c.wall_ms} ms; ${c.error?'error '+c.error.code:'system labels '+c.metrics.label_accuracy_system.numerator+'/'+c.metrics.label_accuracy_system.denominator}; attempts ${c.metrics.attempts??'unknown'}`)});
    console.log(`${result.dry_run?'DRY RUN (hand-written fixtures)':'LIVE'}: ${result.cases.length} cases; ${result.cases.filter(c=>c.error).length} errors. Saved ${path}`);
    return 0;
  } catch(error) {
    console.error(error instanceof Error?error.message:String(error));
    return error instanceof EvalSetupError?2:1;
  }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) process.exitCode=await main();
