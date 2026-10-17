import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {LlamaServerAdapter} from '../src/model/llama-server.js';
import {PROMPT_VERSION,SYSTEM_PROMPT,buildUserPrompt} from '../src/model/prompt.js';
import {buildOutputSchema,buildModelOutputValidator} from '../src/model/output-schema.js';
import {fixtureKey} from '../src/model/fixture.js';
import {MODELS} from '../src/model/models.js';
const domainModule='../src/domain/index.js';
const {segmentBrief}=await import(domainModule);
const adapter=new LlamaServerAdapter();const health=await adapter.health();
const model=MODELS.find(m=>m.slug!=='runtime'&&m.file===health.model_file);
if(health.status!=='ready'||!model)throw Error('Start a registered Gemma with pnpm model:start');
await mkdir('fixtures/model-outputs',{recursive:true});
for(const file of (await readdir('fixtures/demo')).filter(f=>f.endsWith('.json')).sort()){
 const input=JSON.parse(await readFile(path.join('fixtures/demo',file),'utf8'));
 if(input.synthetic!==true)throw Error('Only synthetic demo inputs may be recorded');
 const brief=(input.brief as string).slice(0,8000),message=(input.message as string).slice(0,4000);
 const clauses:Array<{id:string;text:string}>=segmentBrief(brief);
 const result=await adapter.complete({system:SYSTEM_PROMPT,user:buildUserPrompt(clauses,message,input.rate_card),json_schema:buildOutputSchema(clauses,input.rate_card),max_tokens:1100,temperature:0,seed:42});
 buildModelOutputValidator(clauses,input.rate_card).parse(JSON.parse(result.text));
 const key=fixtureKey(brief,message);const fixture={key,provenance:`recorded: ${model.file.replace(/\.gguf$/i,'').toLowerCase()}, llama.cpp b11687, prompt ${PROMPT_VERSION}, ${new Date().toISOString()}`,model_id:model.slug,prompt_version:PROMPT_VERSION,raw_text:result.text,synthetic_input:true};
 await writeFile(path.join('fixtures/model-outputs',`${key}.json`),JSON.stringify(fixture,null,2)+'\n');console.log(JSON.stringify({demo:file,key,latency_ms:result.latency_ms,model_file:result.model_file}));
}
