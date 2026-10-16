import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {serveStatic} from '@hono/node-server/serve-static';
import {AdapterError,type ModelAdapter,type ErrorCode} from '../model/adapter.js';
import {FixtureAdapter} from '../model/fixture.js';
import {LlamaServerAdapter} from '../model/llama-server.js';
import {MODELS} from '../model/models.js';
import {PROMPT_VERSION} from '../model/prompt.js';
import {loadConfig,type ServerConfig} from './config.js';
// Loaded lazily so health and input/body-limit handling also work before domain
// stage A is integrated. The actual analysis module imports domain/index.js.
const analysisModule='../model/analyse.js';
const domainModule='../domain/index.js';
type Input={brief:string;message:string;rate_card:any};
type AnalyseFn=(input:Input,adapter:ModelAdapter,opts:{signal:AbortSignal})=>Promise<any>;
export type AppOptions={adapter?:ModelAdapter;config?:ServerConfig;analyse?:AnalyseFn};
export function createApp(options:AppOptions={}){
 const config=options.config??loadConfig();
 const adapter=options.adapter??(config.mode==='fixture'?new FixtureAdapter(config.fixture_dir):new LlamaServerAdapter(config.llm_url));
 const app=new Hono();let busy=false;
 app.use('/api/*',bodyLimit({maxSize:256*1024,onError:c=>c.json({error:{code:'invalid_input',message:'Request body exceeds 256 KB',details:[]}},413)}));
 app.get('/api/health',async c=>{
  const health=await adapter.health();const entry=MODELS.find(m=>m.slug!=='runtime'&&m.file===health.model_file);
  return c.json({ok:true,mode:adapter.mode,model:{status:health.status,id:entry?entry.file.replace(/\.gguf$/i,'').toLowerCase():health.model_file??'fixture',file:health.model_file,runtime:adapter.mode==='live'?'llama.cpp b11687':'fixture',is_gemma:entry?.slug.startsWith('gemma-')??false,registered:!!entry},limits:{brief_chars:8000,message_chars:4000},prompt_version:PROMPT_VERSION});
 });
 app.post('/api/analyse',async c=>{
  let body:unknown;try{body=await c.req.json();}catch{return c.json({error:{code:'invalid_input',message:'Expected a JSON body',details:[{path:'',message:'Invalid JSON'}]}},400);}
  const input=body as Partial<Input>|null;const details:Array<{path:string;message:string}>=[];
  if(!input||typeof input.brief!=='string'||!input.brief.trim())details.push({path:'brief',message:'Brief must not be empty'});
  if(!input||typeof input.message!=='string'||!input.message.trim())details.push({path:'message',message:'Message must not be empty'});
  if(!input||!input.rate_card||typeof input.rate_card!=='object')details.push({path:'rate_card',message:'Rate card is required'});
  if(details.length)return c.json({error:{code:'invalid_input',message:'Check the input fields',details}},400);
  if(busy)return c.json({error:{code:'model_busy'}},429);
  busy=true;const controller=new AbortController();const clientSignal=c.req.raw.signal;
  const cancel=()=>controller.abort(new AdapterError('cancelled'));clientSignal.addEventListener('abort',cancel,{once:true});if(clientSignal.aborted)cancel();
  const timer=setTimeout(()=>controller.abort(new AdapterError('model_timeout')),config.timeout_ms);timer.unref();
  let abortHandler:(()=>void)|undefined;
  try{
   const {RateCardSchema}=await import(domainModule);const card=RateCardSchema.safeParse(input!.rate_card);
   if(!card.success)return c.json({error:{code:'invalid_input',message:'Check the rate card',details:card.error.issues.map((i:any)=>({path:['rate_card',...i.path].join('.'),message:i.message}))}},400);
   const run=options.analyse??(await import(analysisModule)).analyse as AnalyseFn;
   const aborted=new Promise<never>((_,reject)=>{abortHandler=()=>reject(controller.signal.reason);controller.signal.addEventListener('abort',abortHandler,{once:true});if(controller.signal.aborted)abortHandler();});
   const result=await Promise.race([run({brief:input!.brief!,message:input!.message!,rate_card:card.data},adapter,{signal:controller.signal}),aborted]);
   if(result.ok)return c.json({analysis:result.analysis});
   return errorResponse(c,result.error);
  }catch(error){const e=controller.signal.aborted?controller.signal.reason:error;return errorResponse(c,e instanceof AdapterError?{code:e.code,message:e.message}:{code:'internal'});}
  finally{clearTimeout(timer);clientSignal.removeEventListener('abort',cancel);if(abortHandler)controller.signal.removeEventListener('abort',abortHandler);busy=false;}
 });
 app.all('/api/*',c=>c.json({error:{code:'invalid_input',message:'API route not found'}},404));
 if(config.production){app.get('*',serveStatic({root:config.static_dir}));app.get('*',serveStatic({path:`${config.static_dir}/index.html`}));}
 app.onError((_,c)=>c.json({error:{code:'internal'}},500));
 return app;
}
function errorResponse(c:any,error:{code:ErrorCode;message?:string;attempts?:number;raw?:string}){
 switch(error.code){
 case 'invalid_input':return c.json({error:{code:error.code,message:error.message??'Invalid input',details:[]}},400);
 case 'model_busy':return c.json({error:{code:error.code}},429);
 case 'model_unreachable':return c.json({error:{code:error.code,message:'Start the model with: pnpm model:start'}},503);
 case 'model_output_invalid':return c.json({error:{code:error.code,attempts:error.attempts??3,raw:(error.raw??'').slice(0,4000)}},502);
 case 'model_timeout':return c.json({error:{code:error.code}},504);
 case 'fixture_missing':return c.json({error:{code:error.code}},404);
 case 'cancelled':return c.json({error:{code:error.code}},499);
 default:return c.json({error:{code:'internal'}},500);
 }
}
