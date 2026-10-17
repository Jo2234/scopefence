import type {Analysis,ErrorCode} from '../domain/index.js';
export type {ErrorCode} from '../domain/index.js';
export type Timings = Analysis['timings'];
export interface CompletionRequest {system:string;user:string;json_schema:object;max_tokens:number;temperature:number;seed:number;signal?:AbortSignal}
export interface CompletionResult {text:string;latency_ms:number;timings:Timings;model_file:string|null}
export interface ModelAdapter {readonly mode:'live'|'fixture';health():Promise<{status:'ready'|'unreachable'|'loading';model_file:string|null}>;complete(req:CompletionRequest):Promise<CompletionResult>}
export class AdapterError extends Error {constructor(readonly code:ErrorCode,message:string=code){super(message);this.name='AdapterError';}}
