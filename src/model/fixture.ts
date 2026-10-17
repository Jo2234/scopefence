import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {AdapterError,type ModelAdapter,type CompletionRequest,type CompletionResult} from './adapter.js';
const FixtureSchema=z.object({key:z.string().regex(/^[a-f0-9]{16}$/),provenance:z.string().min(1),model_id:z.string().min(1),prompt_version:z.string().min(1),raw_text:z.string(),synthetic_input:z.literal(true)});
export const fixtureKey=(brief:string,message:string)=>createHash('sha256').update(brief+'\u0000'+message).digest('hex').slice(0,16);
export class FixtureAdapter implements ModelAdapter {
 readonly mode='fixture' as const;
 provenance:string|undefined;
 model_id='fixture';
 private key:string|null=null;
 constructor(private readonly directory=path.resolve('fixtures/model-outputs')){}
 // The completion contract contains prompts, not original inputs. Binding the
 // analysed texts preserves exact fixture keys without reconstructing user data.
 setInput(brief:string,message:string):void{this.key=fixtureKey(brief,message);this.provenance=undefined;this.model_id='fixture';}
 async health(){return {status:'ready' as const,model_file:null};}
 async complete(req:CompletionRequest):Promise<CompletionResult>{
  if(req.signal?.aborted)throw new AdapterError('cancelled');
  if(!this.key)throw new AdapterError('fixture_missing');
  const start=performance.now();let parsed:unknown;
  try{parsed=JSON.parse(await readFile(path.join(this.directory,`${this.key}.json`),'utf8'));}
  catch(error){if(error instanceof Error && 'code' in error && error.code==='ENOENT')throw new AdapterError('fixture_missing');throw new AdapterError('internal','Invalid fixture file');}
  const fixture=FixtureSchema.safeParse(parsed);if(!fixture.success||fixture.data.key!==this.key)throw new AdapterError('internal','Invalid fixture file');
  if(req.signal?.aborted)throw new AdapterError('cancelled');
  this.provenance=fixture.data.provenance;this.model_id=fixture.data.model_id;
  return {text:fixture.data.raw_text,latency_ms:Math.round(performance.now()-start),timings:null,model_file:null};
 }
}
