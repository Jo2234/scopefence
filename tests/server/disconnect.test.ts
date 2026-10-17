import {serve} from '@hono/node-server';
import type {Server} from 'node:http';
import {it,expect} from 'vitest';
import {createApp} from '../../src/server/app.js';
import {ScriptedAdapter} from '../../src/model/scripted.js';
import {AdapterError,type CompletionRequest,type CompletionResult} from '../../src/model/adapter.js';
import demo from '../../fixtures/demo/demo-1.json' with {type:'json'};

it('propagates a real HTTP disconnect to the adapter and accepts the next analysis',async()=>{
  let entered!:()=>void,forwarded!:()=>void;
  const firstEntered=new Promise<void>(resolve=>{entered=resolve;});
  const signalForwarded=new Promise<void>(resolve=>{forwarded=resolve;});
  class DisconnectAdapter extends ScriptedAdapter {
    calls=0;
    override async complete(req:CompletionRequest):Promise<CompletionResult>{
      this.calls++;
      if(this.calls>1)return super.complete(req);
      entered();
      return new Promise((_,reject)=>{
        const fail=()=>{forwarded();reject(new AdapterError('cancelled'));};
        req.signal?.addEventListener('abort',fail,{once:true});
        if(req.signal?.aborted)fail();
      });
    }
  }
  const adapter=new DisconnectAdapter(['{"items":[]}']);
  let server!:Server;
  await new Promise<void>(resolve=>{server=serve({fetch:createApp({adapter}).fetch,hostname:'127.0.0.1',port:0},()=>resolve()) as Server;});
  const address=server.address();if(!address||typeof address==='string')throw Error('No HTTP test port');
  const url=`http://127.0.0.1:${address.port}/api/analyse`;
  const controller=new AbortController();
  const options={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(demo)};
  try{
    const pending=fetch(url,{...options,signal:controller.signal});
    await firstEntered;
    controller.abort();
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    await signalForwarded;
    await new Promise<void>(resolve=>setImmediate(resolve));
    const next=await fetch(url,options);
    expect(next.status).toBe(200);
    expect(await next.json()).toMatchObject({analysis:{items:[]}});
    expect(adapter.calls).toBe(2);
  }finally{
    controller.abort();
    server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
