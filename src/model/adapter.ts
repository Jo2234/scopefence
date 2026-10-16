export type ErrorCode = 'invalid_input' | 'model_unreachable' | 'model_busy' | 'model_timeout' | 'model_output_invalid' | 'fixture_missing' | 'cancelled' | 'internal';
export type Timings = {prompt_tokens:number;predicted_tokens:number;prompt_ms:number;predicted_ms:number}|null;
export interface CompletionRequest {system:string;user:string;json_schema:object;max_tokens:number;temperature:number;seed:number;signal?:AbortSignal}
export interface CompletionResult {text:string;latency_ms:number;timings:Timings;model_file:string|null}
export interface ModelAdapter {readonly mode:'live'|'fixture';health():Promise<{status:'ready'|'unreachable'|'loading';model_file:string|null}>;complete(req:CompletionRequest):Promise<CompletionResult>}
export class AdapterError extends Error {constructor(readonly code:ErrorCode,message:string=code){super(message);this.name='AdapterError';}}
