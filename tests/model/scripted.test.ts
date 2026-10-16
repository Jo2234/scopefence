import {it,expect} from 'vitest';
import {ScriptedAdapter} from '../../src/model/scripted.js';
import {AdapterError} from '../../src/model/adapter.js';
it('consumes queued failures exactly once and records repair inputs',async()=>{const adapter=new ScriptedAdapter([new AdapterError('model_unreachable'),'second']);const request={system:'system',user:'original',json_schema:{},max_tokens:1100,temperature:0,seed:42};await expect(adapter.complete(request)).rejects.toMatchObject({code:'model_unreachable'});expect((await adapter.complete({...request,user:'repaired'})).text).toBe('second');expect(adapter.requests.map(r=>r.user)).toEqual(['original','repaired']);await expect(adapter.complete(request)).rejects.toMatchObject({code:'internal'});});
