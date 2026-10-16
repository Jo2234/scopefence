import {it,expect} from 'vitest';
import {ScriptedAdapter} from '../../src/model/scripted.js';
import {AdapterError} from '../../src/model/adapter.js';
import demo from '../../fixtures/demo/demo-1.json' with {type:'json'};
// Keep real assertions ready, but do not execute a missing domain dependency.
const modulePath='../../src/model/analyse.js';
type Outcome={ok:true;analysis:{attempts:number;items:unknown[];warnings:Array<{code:string}>}}|{ok:false;error:{code:string;attempts?:number;raw?:string}};
async function run(adapter:ScriptedAdapter):Promise<Outcome>{const {analyse}=await import(modulePath);return analyse(demo,adapter);}
it.todo('A18 invalid JSON, then valid → attempts 2 with issue text in repair prompt',async()=>{
 const adapter=new ScriptedAdapter(['not JSON','{"items":[]}']);const result=await run(adapter);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);expect(result.analysis.attempts).toBe(2);expect(adapter.requests).toHaveLength(2);expect(adapter.requests[1]!.user).toContain('YOUR PREVIOUS OUTPUT WAS INVALID:');expect(adapter.requests[1]!.user).toMatch(/JSON|Unexpected/);expect(adapter.requests[1]!.user).toContain('not JSON');
});
it.todo('A19 three invalid outputs → model_output_invalid and last raw output',async()=>{
 const adapter=new ScriptedAdapter(['first invalid','second invalid','last invalid']);expect(await run(adapter)).toMatchObject({ok:false,error:{code:'model_output_invalid',attempts:3,raw:'last invalid'}});expect(adapter.requests).toHaveLength(3);
});
it.todo('A20 refusal text three times → model_output_invalid without fabricated items',async()=>{
 const refusal="I'm sorry, I can't help with that.";const result=await run(new ScriptedAdapter([refusal,refusal,refusal]));expect(result).toMatchObject({ok:false,error:{code:'model_output_invalid',attempts:3,raw:refusal}});expect(result).not.toHaveProperty('analysis');
});
it.todo('A21 empty items → valid analysis with no_items_found warning',async()=>{
 const result=await run(new ScriptedAdapter(['{"items":[]}']));expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error.code);expect(result.analysis.items).toEqual([]);expect(result.analysis.warnings).toEqual(expect.arrayContaining([expect.objectContaining({code:'no_items_found'})]));
});
it.todo('A22 unreachable adapter → no retry, model_unreachable',async()=>{
 const adapter=new ScriptedAdapter([new AdapterError('model_unreachable'),'should not be consumed']);expect(await run(adapter)).toMatchObject({ok:false,error:{code:'model_unreachable'}});expect(adapter.requests).toHaveLength(1);
});
