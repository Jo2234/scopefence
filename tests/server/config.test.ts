import {it,expect} from 'vitest';
import {loadConfig} from '../../src/server/config.js';
it('defaults to live and binds only the fixed loopback app port',()=>{expect(loadConfig({})).toMatchObject({mode:'live',llm_url:'http://127.0.0.1:8089',host:'127.0.0.1',port:5178,timeout_ms:240000,production:false});});
it('does not expose scripted mode through environment',()=>{expect(()=>loadConfig({SCOPEFENCE_MODE:'scripted'})).toThrow();expect(loadConfig({SCOPEFENCE_MODE:'fixture',NODE_ENV:'production'})).toMatchObject({mode:'fixture',production:true});});
