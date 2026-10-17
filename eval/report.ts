import { readdir, readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aggregateMetrics } from './metrics.js';
import { loadCases } from './cases.js';
import type { EvalCase } from './types.js';
import type { Rate, AggregateMetrics } from './metrics.js';
import type { RunResult } from './run.js';
const repoRoot=fileURLToPath(new URL('../',import.meta.url));
export interface ResultFile {file:string;result:RunResult}
export function formatRate(r:Rate):string {
  return r.denominator===0?`${r.numerator}/0 (n/a)`:`${r.numerator}/${r.denominator} (${(r.numerator/r.denominator*100).toFixed(1)}%)`;
}
const cell=(value:unknown)=>String(value??'not recorded').replaceAll('|','\\|').replaceAll(/\r?\n/g,' ').replaceAll('<','&lt;').replaceAll('>','&gt;');
const seconds=(ms:number|null)=>ms===null?'n/a':`${(ms/1000).toFixed(1)} s`;
export async function readResults(directory=join(repoRoot,'eval/results')):Promise<ResultFile[]> {
  let files:string[];
  try {files=(await readdir(directory)).filter(f=>f.endsWith('.json')).sort();}
  catch(error) {if((error as NodeJS.ErrnoException).code==='ENOENT') return [];throw error;}
  const results:ResultFile[]=[];
  for(const file of files) {
    let r:RunResult;
    try {r=JSON.parse(await readFile(join(directory,file),'utf8')) as RunResult;}
    catch(error) {throw new Error(`Cannot parse ${file}: ${error instanceof Error?error.message:String(error)}`);}
    // Never publish fixture scores as live measurements, even if a fixture file was copied up a level.
    if(r.dry_run===true) continue;
    if(r.schema_version!==1||r.synthetic!==true||r.dry_run!==false||!Array.isArray(r.cases)||!r.metadata||r.cases.length===0)
      throw new Error(`Invalid evaluation results schema: ${file}`);
    if(!r.metadata.verified_sha256||r.metadata.verified_sha256!==r.metadata.model_sha256)
      throw new Error(`Unverified model hash in ${file}; refusing a measured report`);
    if(r.cases.some(c=>c.analysis&&c.analysis.mode!=='live')) throw new Error(`Fixture analysis found in live result ${file}`);
    results.push({file,result:r});
  }
  return results;
}
function metricRows(a:AggregateMetrics):[string,string][] {
  return [
    ['Cases',String(a.cases)],['System label accuracy',formatRate(a.label_accuracy_system)],['Raw model label accuracy',formatRate(a.label_accuracy_model)],
    ['Citation exactness',formatRate(a.citation_exactness)],['Included clause correct',formatRate(a.included_clause_correct)],['Clarification recall',formatRate(a.clarification_recall)],
    ['Injection resisted',formatRate(a.injection_resisted)],['Model obeyed injection',formatRate(a.model_obeyed_injection)],
    ['Spurious items',String(a.spurious_items)],['Duplicate leak (gold items)',String(a.duplicate_leak)],
    ['JSON valid first attempt',formatRate(a.json_valid_first_attempt)],['JSON valid by final attempt',formatRate(a.json_valid_after_repair)],
    ['Attempts histogram',Object.entries(a.attempts_histogram).map(([attempt,n])=>`${attempt==='unknown'?'attempts unknown':attempt+' attempt(s)'}: ${n}/${a.cases} cases`).join('; ')],
    ['Wall latency median',seconds(a.latency_ms.median)],['Wall latency p90 (nearest rank)',seconds(a.latency_ms.p90)],['Wall latency max',seconds(a.latency_ms.max)],
    ['Latency samples',`${a.latency_ms.samples}/${a.cases} cases`],['Prompt tokens',String(a.prompt_tokens)],['Predicted tokens',String(a.predicted_tokens)],
    ['Timing samples',`${a.timing_samples}/${a.cases} cases`],['Predicted tokens/second',a.predicted_tokens_per_second===null?'n/a':a.predicted_tokens_per_second.toFixed(1)],
  ];
}
/** Use the full frozen corpus, even when results contain only one split. */
export function caseDesignCaveats(cases:EvalCase[]):string[] {
  if(!cases.length) throw new Error('Case design caveats require the case files');
  const explicitExclusions=cases.filter(c=>/^\s*Out of scope:/im.test(c.brief)).length;
  const wordLimit=100;
  const messages=cases.map(c=>({id:c.id,words:c.message.trim().split(/\s+/u).filter(Boolean).length}));
  const longer=messages.filter(m=>m.words>wordLimit);
  return [
    '## Case design caveats', '',
    '- All cases are invented by the build team.',
    `- ${explicitExclusions}/${cases.length} briefs contain an explicit out-of-scope list; realistic briefs often do not.`,
    `- ${messages.length-longer.length}/${cases.length} messages are short (${wordLimit} words or fewer).${longer.length?' Longer messages: '+longer.map(m=>cell(m.id)+' ('+m.words+' words)').join(', ')+'.':' No messages exceed that threshold.'}`,
    '- The gold labels were written by the same team that built the tool; this is not an independent evaluation.', '',
  ];
}
/** Repeated runs and prompt versions stay separate; no silently pooled tuning runs. */
export function renderReport(files:ResultFile[],cases:EvalCase[]):string {
  if(!files.length) throw new Error('No live evaluation results exist. No numbered report was generated.');
  const count=new Set(files.flatMap(f=>f.result.cases.map(c=>c.id))).size;
  const lines=['# ScopeFence evaluation','',`All cases are invented. Results are from ${count} cases and are not a benchmark.`,
    '', 'Every input is synthetic. Gold labels were written by the build team and reviewed by the project lead. Scores describe these cases only. Repeated runs and prompt versions are reported separately.',
    '', 'Ratios use their full denominators; missed items and failed cases are wrong gold items. Citation exactness uses non-empty raw brief quotes. A zero denominator is n/a. “JSON valid by final attempt” includes first-attempt successes. Latency is measured wall time including failures; p90 uses nearest rank. Tokens/second uses predicted tokens divided by reported generation time, excluding cases without timings.',
    '', ...caseDesignCaveats(cases), '## Run metadata',''];
  for(const {file,result:r} of files) {
    const m=r.metadata;
    lines.push(`### ${cell(file)}`,'',
      `- Source: [${cell(file)}](../eval/results/${encodeURIComponent(file)})`,
      `- Git: ${cell(m.git_sha)}; gold case commit: ${cell(m.cases_git_sha)}; prompt: ${cell(m.prompt_version)}.`,
      `- Model: ${cell(m.model_slug)}; file: ${cell(m.model_file)}; registry SHA256: ${cell(m.model_sha256)}; streamed SHA256: ${cell(m.verified_sha256)}.`,
      `- llama.cpp build reported by server: ${cell(m.llama_cpp_build)}; expected pinned build: ${cell(m.expected_llama_cpp_build)}.`,
      `- Server flags: ${m.server_flags?cell(m.server_flags.join(' ')):'not recorded'}.`,
      `- CPU: ${cell(m.cpu_brand)}; RAM: ${m.ram_bytes} bytes; OS: ${cell(m.os)}; Node: ${cell(m.node_version)}.`,
      `- UTC start: ${cell(m.start_utc)}; end: ${cell(m.end_utc)}; other heavy processes: ${m.other_heavy_processes===null?'not known':cell(m.other_heavy_processes)}.`,
      `- Provenance: ${cell(m.provenance)}.`, '');
  }
  const groups=new Map<string,{file:string;result:RunResult;cases:RunResult['cases']}[]>();
  for(const {file,result} of files) for(const split of ['dev','test'] as const) {
    const cases=result.cases.filter(c=>c.split===split); if(!cases.length) continue;
    const key=`${result.metadata.model_slug} / ${split}`;
    const group=groups.get(key)??[];group.push({file,result,cases});groups.set(key,group);
  }
  lines.push('## Metrics by model and split','');
  for(const [key,group] of groups) {
    lines.push(`### ${cell(key)}`,'',`| Metric | ${group.map(g=>cell(`${g.file} (${g.result.metadata.prompt_version})`)).join(' | ')} |`,
      `| --- | ${group.map(()=> '---').join(' | ')} |`);
    const rows=group.map(g=>metricRows(aggregateMetrics(g.cases.map(c=>c.metrics))));
    for(let i=0;i<rows[0]!.length;i++) lines.push(`| ${rows[0]![i]![0]} | ${rows.map(r=>cell(r[i]![1])).join(' | ')} |`);
    lines.push('', 'Per-case results:', '', '| Run | Case | System labels | Raw labels | Citations | Injection resisted | Wall time | Attempts | Error |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for(const g of group) for(const c of g.cases) lines.push(`| ${cell(g.file)} | ${cell(c.id)} | ${formatRate(c.metrics.label_accuracy_system)} | ${formatRate(c.metrics.label_accuracy_model)} | ${formatRate(c.metrics.citation_exactness)} | ${formatRate(c.metrics.injection_resisted)} | ${seconds(c.wall_ms)} | ${c.metrics.attempts??'unknown'} | ${cell(c.error?.code??'none')} |`);
    lines.push('');
  }
  lines.push('## Failures','');
  let failureCount=0;
  for(const {file,result} of files) {
    const failed=result.cases.filter(c=>c.metrics.failures.length);
    if(!failed.length) continue;
    lines.push(`### ${cell(file)}`,'','| Case | Check | Gold anchor | Expected | Predicted | Message quote | Brief quote |','| --- | --- | --- | --- | --- | --- | --- |');
    for(const c of failed) for(const f of c.metrics.failures) {
      failureCount++;
      lines.push(`| ${cell(c.id)} | ${cell(f.kind)} | ${cell(f.anchor)} | ${cell(f.expected)} | ${cell(f.predicted)} | ${cell(f.message_quote??'none')} | ${cell(f.brief_quote??'none')} |`);
    }
    lines.push('');
  }
  if(!failureCount) lines.push('No wrong items or evaluation errors were recorded in these runs.','');
  return lines.join('\n')+'\n';
}
export async function generateReport(directory=join(repoRoot,'eval/results'),output=join(repoRoot,'docs/eval-report.md')) {
  const [files,cases]=await Promise.all([readResults(directory),loadCases()]);
  const markdown=renderReport(files,cases);
  await mkdir(dirname(output),{recursive:true});
  const temp=output+`.${process.pid}.tmp`;
  await writeFile(temp,markdown,'utf8');await rename(temp,output);
  return {path:output,runs:files.length};
}
export async function main(args=process.argv.slice(2)):Promise<number> {
  if(args.length) {console.error('Usage: pnpm eval:report (reads eval/results/*.json)');return 2;}
  try {const r=await generateReport();console.log(`Wrote ${r.path} from ${r.runs} live result file(s).`);return 0;}
  catch(error) {console.error(error instanceof Error?error.message:String(error));return 1;}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url) process.exitCode=await main();
