import path from 'node:path';
import {AdapterError,type ModelAdapter,type CompletionRequest,type CompletionResult,type Timings} from './adapter.js';
type Fetch = typeof globalThis.fetch;
export class LlamaServerAdapter implements ModelAdapter {
 readonly mode='live' as const;
 constructor(private readonly url='http://127.0.0.1:8089',private readonly fetcher:Fetch=globalThis.fetch) {const parsed=new URL(url);if(!['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)||parsed.protocol!=='http:')throw new Error('Model URL must be local HTTP');}
 async health():Promise<{status:'ready'|'unreachable'|'loading';model_file:string|null}>{
  try {const signal=AbortSignal.timeout(2000);const props=await this.fetcher(`${this.url}/props`,{signal,redirect:'error'});if(props.status===503)return {status:'loading',model_file:null};
   if(props.ok){const data=await props.json() as {model_path?:string};if(data.model_path)return {status:'ready',model_file:path.basename(data.model_path)};}
   const models=await this.fetcher(`${this.url}/v1/models`,{signal,redirect:'error'});if(models.status===503)return {status:'loading',model_file:null};if(!models.ok)return {status:'unreachable',model_file:null};const data=await models.json() as {data?:Array<{id?:string}>};return {status:'ready',model_file:data.data?.[0]?.id?path.basename(data.data[0].id):null};
  }catch{return {status:'unreachable',model_file:null};}
 }
 async complete(req:CompletionRequest):Promise<CompletionResult>{
  const start=performance.now();if(req.signal?.aborted)throw new AdapterError('cancelled');
  const timeout=AbortSignal.timeout(240000);const signal=req.signal?AbortSignal.any([req.signal,timeout]):timeout;
  try{
   const identity=await this.health();if(req.signal?.aborted)throw new AdapterError('cancelled');if(identity.status!=='ready')throw new AdapterError('model_unreachable',identity.status==='loading'?'model loading':'Start the model with: pnpm model:start');
   const res=await this.fetcher(`${this.url}/v1/chat/completions`,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({messages:[{role:'system',content:req.system},{role:'user',content:req.user}],temperature:req.temperature,seed:req.seed,max_tokens:req.max_tokens,cache_prompt:true,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_schema',json_schema:{name:'scopefence_analysis',strict:true,schema:req.json_schema}}})});
   if(res.status===503)throw new AdapterError('model_unreachable','model loading');if(!res.ok)throw new AdapterError('model_output_invalid',`Local model HTTP ${res.status}`);
   const data=await res.json() as {choices?:Array<{message?:{content?:string}}> ;timings?:{prompt_n?:number;predicted_n?:number;prompt_ms?:number;predicted_ms?:number};usage?:{prompt_tokens?:number;completion_tokens?:number}};
   const t=data.timings;const timings:Timings=t?{prompt_tokens:t.prompt_n??data.usage?.prompt_tokens??0,predicted_tokens:t.predicted_n??data.usage?.completion_tokens??0,prompt_ms:t.prompt_ms??0,predicted_ms:t.predicted_ms??0}:null;
   return {text:data.choices?.[0]?.message?.content??'',latency_ms:Math.round(performance.now()-start),timings,model_file:identity.model_file};
  }catch(error){if(error instanceof AdapterError)throw error;if(req.signal?.aborted)throw new AdapterError('cancelled');if(timeout.aborted)throw new AdapterError('model_timeout');throw new AdapterError('model_unreachable','Start the model with: pnpm model:start');}
 }
}
