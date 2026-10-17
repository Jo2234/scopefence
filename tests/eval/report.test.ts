import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { it, expect, afterEach } from 'vitest';
import { formatRate, renderReport, readResults, generateReport } from '../../eval/report.js';
import { loadCases } from '../../eval/cases.js';
import { measureCase, aggregateMetrics, rate } from '../../eval/metrics.js';
import { analysis, item } from './helpers.js';
import type { RunResult } from '../../eval/run.js';
const [c]=await loadCases();
const folders:string[]=[];
async function temp() {const p=await mkdtemp(join(tmpdir(),'scopefence-report-'));folders.push(p);return p;}
afterEach(async()=>{await Promise.all(folders.splice(0).map(p=>rm(p,{recursive:true,force:true})));});
function fixture():RunResult {
  // Hand-built synthetic test data in a temp directory, never committed as live measurements.
  const a=analysis(c!,[item(c!,c!.expected_items[0]!.anchor,{label:'extra_work',model_label:'included',brief_quote:'invented | clause'})],{mode:'live'});
  const metrics=measureCase(c!,a,{latency_ms:1234});
  return {schema_version:1,synthetic:true,note:'Invented example for testing; not a real client or project.',dry_run:false,
    metadata:{git_sha:'a'.repeat(40),cases_git_sha:'b'.repeat(40),prompt_version:'test-version',model_slug:'gemma-4-e2b',model_file:'test.gguf',model_sha256:'c'.repeat(64),verified_sha256:'c'.repeat(64),
      llama_cpp_build:null,expected_llama_cpp_build:'llama.cpp b11687',server_flags:null,cpu_brand:'Test CPU',ram_bytes:8000000000,os:'test OS',node_version:'v24',
      start_utc:'2026-10-16T01:00:00Z',end_utc:'2026-10-16T01:00:02Z',other_heavy_processes:null,split:'dev',case_ids:[c!.id],provenance:'hand-written report test fixture'},
    cases:[{id:c!.id,split:'dev',title:c!.title,tags:c!.tags,expected_items:c!.expected_items,forbidden_included:[],expect_injection:false,analysis:a,error:null,raw_model_output:a.raw_model_output,wall_ms:1234,metrics}],
    aggregate:aggregateMetrics([metrics]),by_split:{dev:aggregateMetrics([metrics])}};
}
it('prints every percentage with a denominator, undefined rates as n/a and second values to one decimal',()=> {
  expect(formatRate(rate(14,19))).toBe('14/19 (73.7%)');
  expect(formatRate(rate(0,0))).toBe('0/0 (n/a)');
  const report=renderReport([{file:'test-only.json',result:fixture()}]);
  expect(report).toContain('All cases are invented. Results are from 1 cases and are not a benchmark.');
  expect(report).toContain('| System label accuracy | 0/1 (0.0%) |');
  expect(report).toContain('| Raw model label accuracy | 1/1 (100.0%) |');
  expect(report).toContain('| Wall latency median | 1.2 s |');
  expect(report).toContain('| Wall latency p90 (nearest rank) | 1.2 s |');
  expect(report).toContain('| Wall latency max | 1.2 s |');
  expect(report).toContain('invented \\| clause');
  expect(report).toContain('## Failures');
  expect(report).toContain('extra_work');
  expect(report).toContain('not recorded');
  for(const match of report.matchAll(/\d+\.\d+%/g)) {
    expect(report.slice(Math.max(0,match.index!-20),match.index)).toMatch(/\d+\/\d+ \($/);
  }
});
it('keeps repeated prompt versions in separate columns and never averages dev with test',()=> {
  const first=fixture(),second=structuredClone(first);
  second.metadata.prompt_version='test-version-2';
  second.cases[0]!.split='test';second.cases[0]!.id='test-only';
  const r=renderReport([{file:'first.json',result:first},{file:'second.json',result:second},{file:'third.json',result:first}]);
  expect(r).toContain('### gemma-4-e2b / dev');
  expect(r).toContain('### gemma-4-e2b / test');
  expect(r).toContain('| Metric | first.json (test-version) | third.json (test-version) |');
  expect(r).toContain('Results are from 2 cases');
});
it('ignores dry-run JSONs, refuses fixture/unverified live results and does not create a numbered report without live data',async()=> {
  const dir=await temp(),output=join(dir,'docs/eval-report.md');
  const dry={...fixture(),dry_run:true};
  await writeFile(join(dir,'fixture.json'),JSON.stringify(dry));
  await mkdir(join(dir,'dry-run'));await writeFile(join(dir,'dry-run/another.json'),JSON.stringify(dry));
  expect(await readResults(dir)).toEqual([]);
  await expect(generateReport(dir,output)).rejects.toThrow('No live evaluation results');
  expect(existsSync(output)).toBe(false);
  const unverified=fixture();unverified.metadata.verified_sha256=null;
  await writeFile(join(dir,'unverified.json'),JSON.stringify(unverified));
  await expect(readResults(dir)).rejects.toThrow('Unverified model hash');
  await rm(join(dir,'unverified.json'));
  const disguised=fixture();disguised.cases[0]!.analysis!.mode='fixture';
  await writeFile(join(dir,'disguised.json'),JSON.stringify(disguised));
  await expect(readResults(dir)).rejects.toThrow('Fixture analysis');
});
it('generates a report from saved result JSON and retains failed-case denominators',async()=> {
  const dir=await temp(),output=join(dir,'docs/eval-report.md');
  const r=fixture(),failed=structuredClone(r.cases[0]!);
  failed.id='dev-error';failed.analysis=null;failed.error={code:'model_output_invalid',message:'bad output',attempts:3};
  failed.metrics=measureCase(c!,null,{attempts:3,latency_ms:3000,error:'model_output_invalid'});failed.wall_ms=3000;
  r.cases.push(failed);
  await writeFile(join(dir,'hand-built-test.json'),JSON.stringify(r));
  await generateReport(dir,output);
  const report=await readFile(output,'utf8');
  expect(report).toContain('| System label accuracy | 0/2 (0.0%) |');
  expect(report).toContain('| Raw model label accuracy | 1/2 (50.0%) |');
  expect(report).toContain('model_output_invalid');
  expect(report).toContain('| Wall latency median | 2.1 s |');
});
