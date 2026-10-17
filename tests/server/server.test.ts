import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {it,expect} from 'vitest';
import {createApp} from '../../src/server/app.js';
import demo from '../../fixtures/demo/demo-1.json' with {type:'json'};
import {ScriptedAdapter} from '../../src/model/scripted.js';
import {AdapterError,type CompletionRequest} from '../../src/model/adapter.js';
import {loadConfig} from '../../src/server/config.js';
import {FixtureAdapter} from '../../src/model/fixture.js';
const app=()=>createApp({adapter:new FixtureAdapter()});
it('reports fixture mode, limits, and prompt version without a live server',async()=>{const response=await app().request('/api/health');expect(response.status).toBe(200);const data=await response.json();expect(data).toMatchObject({ok:true,mode:'fixture',model:{status:'ready'},limits:{brief_chars:8000,message_chars:4000},prompt_version:'pv1'});expect(response.headers.has('access-control-allow-origin')).toBe(false);});
it('returns structured invalid input details on an empty brief',async()=>{const response=await app().request('/api/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief:' ',message:'Add a card',rate_card:{}})});expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:{code:'invalid_input',details:[{path:'brief'}]}});});
it('rejects malformed JSON and handles unknown API paths as JSON',async()=>{const response=await app().request('/api/analyse',{method:'POST',body:'{'});expect(response.status).toBe(400);const missing=await app().request('/api/unknown');expect(missing.status).toBe(404);expect(missing.headers.get('Content-Type')).toContain('application/json');});
it('rejects bodies over 256 KB',async()=>{const response=await app().request('/api/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({brief:'x'.repeat(262145),message:'message',rate_card:{}})});expect([400,413]).toContain(response.status);});

const post=(app:ReturnType<typeof createApp>,input:unknown=demo,signal?:AbortSignal)=>app.request('/api/analyse',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
it('fixture hit → 200 with analysis.mode fixture',async()=>{const response=await post(app());expect(response.status).toBe(200);expect(await response.json()).toMatchObject({analysis:{mode:'fixture',model:{provenance:expect.stringContaining('recorded:')}}});});
it('fixture miss → 404 fixture_missing',async()=>{const response=await post(app(),{...demo,message:'Unrecorded synthetic request.'});expect(response.status).toBe(404);expect(await response.json()).toEqual({error:{code:'fixture_missing'}});});
it('two concurrent analyses → one gets 429',async()=>{
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});const held=new Promise<void>(resolve=>{release=resolve;});
 class Slow extends ScriptedAdapter{override async complete(req:CompletionRequest){entered();await held;return super.complete(req);}}
 const app=createApp({adapter:new Slow(['{"items":[]}'])});const first=post(app);await started;const second=await post(app);expect(second.status).toBe(429);expect(await second.json()).toEqual({error:{code:'model_busy'}});release();expect((await first).status).toBe(200);
});
it('overall timeout and client abort release the mutex',async()=>{
 let entered!:()=>void;let started=new Promise<void>(resolve=>{entered=resolve;});
 class Abortable extends ScriptedAdapter{override async complete(req:CompletionRequest){entered();return await new Promise<never>((_,reject)=>{const fail=()=>reject(new AdapterError('cancelled'));req.signal?.addEventListener('abort',fail,{once:true});if(req.signal?.aborted)fail();});}}
 const timeoutApp=createApp({adapter:new Abortable([]),config:{...loadConfig({}),timeout_ms:30}});const timed=await post(timeoutApp);expect(timed.status).toBe(504);expect((await post(timeoutApp)).status).toBe(504);
 const abortApp=createApp({adapter:new Abortable([])});started=new Promise<void>(resolve=>{entered=resolve;});const controller=new AbortController();const pending=post(abortApp,demo,controller.signal);await started;controller.abort();expect((await pending).status).toBe(499);
 started=new Promise<void>(resolve=>{entered=resolve;});const nextController=new AbortController();const next=post(abortApp,demo,nextController.signal);await started;nextController.abort();expect((await next).status).toBe(499);
});
it('serves the built UI for production navigation and keeps API misses as JSON',async()=>{const directory=await mkdtemp(path.join(os.tmpdir(),'scopefence-static-'));try{await writeFile(path.join(directory,'index.html'),'<!doctype html><title>ScopeFence</title>');const prod=createApp({adapter:new FixtureAdapter(),config:{...loadConfig({NODE_ENV:'production'}),static_dir:directory}});const page=await prod.request('/review/example');expect(page.status).toBe(200);expect(page.headers.get('content-type')).toContain('text/html');expect(await page.text()).toContain('ScopeFence');const api=await prod.request('/api/missing');expect(api.status).toBe(404);expect(api.headers.get('content-type')).toContain('application/json');}finally{await rm(directory,{recursive:true,force:true});}});
it('rejects invalid rate cards with field paths before attempting the model',async()=>{const adapter=new ScriptedAdapter(['unused']);const response=await post(createApp({adapter}),{...demo,rate_card:{...demo.rate_card,currency:'JPY'}});expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:{code:'invalid_input',details:[{path:'rate_card.currency'}]}});expect(adapter.requests).toHaveLength(0);});
it('maps unreachable and invalid model output to the specified JSON errors',async()=>{
 const unavailable=await post(createApp({adapter:new ScriptedAdapter([new AdapterError('model_unreachable')])}));expect(unavailable.status).toBe(503);expect(await unavailable.json()).toEqual({error:{code:'model_unreachable',message:'Start the model with: pnpm model:start'}});
 const invalid=await post(createApp({adapter:new ScriptedAdapter(['first','second','z'.repeat(5000)])}));expect(invalid.status).toBe(502);expect(await invalid.json()).toEqual({error:{code:'model_output_invalid',attempts:3,raw:'z'.repeat(4000)}});
});
it('uses the configured fixture directory without the default fixtures',async()=>{const directory=await mkdtemp(path.join(os.tmpdir(),'scopefence-isolated-'));try{const isolated=createApp({config:loadConfig({SCOPEFENCE_MODE:'fixture',SCOPEFENCE_FIXTURE_DIR:directory})});const response=await post(isolated);expect(response.status).toBe(404);expect(await response.json()).toEqual({error:{code:'fixture_missing'}});}finally{await rm(directory,{recursive:true,force:true});}});
