// Domain stage A is not yet on main. Keep the specified cross-slot import visible
// until the lead approves its merge and confirms the underspecified signatures.
// @ts-expect-error Domain stage A integration is pending.
import {truncate,segmentBrief,detectInjection,reconcile,ModelOutputSchema} from '../domain/index.js';
import {AdapterError,type ModelAdapter} from './adapter.js';
export async function analyse(_input:{brief:string;message:string;rate_card:unknown},_adapter:ModelAdapter,_opts?:{signal?:AbortSignal;max_attempts?:number}):Promise<never>{
 void [truncate,segmentBrief,detectInjection,reconcile,ModelOutputSchema];
 throw new AdapterError('internal','Domain stage A integration is pending');
}
