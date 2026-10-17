import {AdapterError,type ModelAdapter,type CompletionRequest,type CompletionResult} from './adapter.js';
/** Unit tests only. Never selectable by application configuration. */
export class ScriptedAdapter implements ModelAdapter {
 readonly mode='fixture' as const;
 readonly requests:CompletionRequest[]=[];
 private readonly queue:Array<string|AdapterError>;
 constructor(queue:Array<string|AdapterError>){this.queue=[...queue];}
 async health(){return {status:'ready' as const,model_file:null};}
 async complete(req:CompletionRequest):Promise<CompletionResult>{this.requests.push(req);if(req.signal?.aborted)throw new AdapterError('cancelled');const value=this.queue.shift();if(value instanceof AdapterError)throw value;if(value===undefined)throw new AdapterError('internal','Scripted queue exhausted');return {text:value,latency_ms:0,timings:null,model_file:null};}
}
