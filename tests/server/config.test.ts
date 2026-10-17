import {it,expect} from 'vitest';
import {loadConfig} from '../../src/server/config.js';
it('defaults to live and binds only the fixed loopback app port',()=>{expect(loadConfig({})).toMatchObject({mode:'live',llm_url:'http://127.0.0.1:8089',host:'127.0.0.1',port:5178,timeout_ms:240000,production:false});});
it('does not expose scripted mode through environment',()=>{expect(()=>loadConfig({SCOPEFENCE_MODE:'scripted'})).toThrow();expect(loadConfig({SCOPEFENCE_MODE:'fixture',NODE_ENV:'production'})).toMatchObject({mode:'fixture',production:true});});
it('uses an isolated fixture directory and configured port while retaining loopback',()=>{const config=loadConfig({SCOPEFENCE_FIXTURE_DIR:'/tmp/scopefence-test-fixtures',SCOPEFENCE_PORT:'5278'});expect(config).toMatchObject({fixture_dir:'/tmp/scopefence-test-fixtures',port:5278,host:'127.0.0.1'});});
it.each(['0','65536','1.5','-1','abc','5178junk',''])('rejects invalid port %j',port=>{expect(()=>loadConfig({SCOPEFENCE_PORT:port})).toThrow('SCOPEFENCE_PORT');});
