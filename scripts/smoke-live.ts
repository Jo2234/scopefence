import {readFile} from 'node:fs/promises';
import {LlamaServerAdapter} from '../src/model/llama-server.js';
import {SYSTEM_PROMPT,buildUserPrompt} from '../src/model/prompt.js';
import {buildOutputSchema,buildModelOutputValidator} from '../src/model/output-schema.js';
const demo=JSON.parse(await readFile(new URL('../fixtures/demo/demo-1.json',import.meta.url),'utf8'));
// G0-only line splitter. Replace with segmentBrief after domain stage A lands.
const clauses:string[]=demo.brief.split('\n');const segmented=clauses.filter(s=>s.trim()).map((s,i)=>({id:`C${i+1}`,text:s.trim()}));
const adapter=new LlamaServerAdapter();const started=performance.now();const result=await adapter.complete({system:SYSTEM_PROMPT,user:buildUserPrompt(segmented,demo.message,demo.rate_card),json_schema:buildOutputSchema(segmented,demo.rate_card),max_tokens:1100,temperature:0,seed:42});
const valid=buildModelOutputValidator(segmented,demo.rate_card).safeParse(JSON.parse(result.text));
console.log(JSON.stringify({wall_ms:Math.round(performance.now()-started),...result,valid:valid.success,issues:valid.success?[]:valid.error.issues},null,2));if(!valid.success)process.exitCode=1;
