import {spawn,execFileSync} from 'node:child_process';
import {openSync} from 'node:fs';
import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import registry from '../src/model/models.json' with {type:'json'};
import {cache,path,verified} from './download-common.mjs';
const run=path.join(cache,'run'), pidFile=path.join(run,'llama-server.pid');
async function pid(){try{const value=Number(await readFile(pidFile,'utf8'));return Number.isSafeInteger(value)&&value>1?value:null;}catch{return null;}}
function isServer(id){if(!id||!alive(id))return false;try{return path.basename(execFileSync('ps',['-p',String(id),'-o','comm='],{encoding:'utf8'}).trim())==='llama-server';}catch{return false;}}
function alive(id){try{process.kill(id,0);return true;}catch{return false;}}
async function binary(dir){for(const item of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isFile()&&item.name==='llama-server')return full;if(item.isDirectory()){const found=await binary(full);if(found)return found;}}}
const action=process.argv[2];
if(action==='status'){const id=await pid();console.log(JSON.stringify({running:isServer(id),pid:id}));}
else if(action==='stop'){const id=await pid();if(id&&alive(id)&&!isServer(id))throw Error('PID file refers to another process; refusing to signal it');if(isServer(id)){process.kill(id,'SIGTERM');for(let n=0;n<100&&alive(id);n++)await new Promise(r=>setTimeout(r,100));if(alive(id))throw Error(`Server ${id} did not stop; inspect before restarting`);}await rm(pidFile,{force:true});console.log('Model stopped');}
else if(action==='start'){
 let existing='';try{existing=execFileSync('pgrep',['-fl','llama-server'],{encoding:'utf8'}).trim();}catch(error){if(error.status!==1)throw error;}
 if(existing)throw Error(`Refusing to start: another llama-server is running:\n${existing}`);
 const model=registry.find(x=>x.slug===(process.argv[3]??'gemma-4-e2b')&&x.slug!=='runtime');if(!model)throw Error('Unknown model slug');
 const modelPath=path.join(cache,'models',model.file);if(!await verified(modelPath,model))throw Error('Model absent or hash mismatch; run pnpm model:download');
 const runtime=registry.find(x=>x.slug==='runtime');if(!await verified(path.join(cache,'runtime','llama-b11687',runtime.file),runtime))throw Error('Runtime archive absent or hash mismatch; run pnpm runtime:fetch');
 const bin=await binary(path.join(cache,'runtime','llama-b11687'));if(!bin)throw Error('Runtime binary missing');
 await mkdir(run,{recursive:true});await mkdir(path.join(cache,'logs'),{recursive:true});
 const utc=new Date().toISOString().replaceAll(':','-');const log=path.join(cache,'logs',`llama-server-${utc}.log`);
 const ngl=process.env.SCOPEFENCE_GPU_LAYERS??'0';if(!['0','99'].includes(ngl))throw Error('SCOPEFENCE_GPU_LAYERS must be 0 or 99');
 const flags=['-m',modelPath,'--host','127.0.0.1','--port','8089','-c','8192','-t','4','-ngl',ngl,'-np','1','--jinja','--reasoning-budget','0','--no-webui','--seed','42','--cors-origins','','--no-cors-credentials'];
 const fd=openSync(log,'a');const start=performance.now();const child=spawn(bin,flags,{detached:true,stdio:['ignore',fd,fd]});await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await writeFile(pidFile,String(child.pid));
 await writeFile(path.join(run,'server.json'),JSON.stringify({pid:child.pid,model: model.slug,model_file:model.file,binary:bin,flags,log,started_at:new Date().toISOString()},null,2));
 try{while(performance.now()-start<180000){if(!alive(child.pid))throw Error(`Model exited; see ${log}`);try{const res=await fetch('http://127.0.0.1:8089/health',{signal:AbortSignal.timeout(1000)});if(res.status===200){console.log(JSON.stringify({status:'ready',pid:child.pid,load_ms:Math.round(performance.now()-start),log,flags}));process.exit(0);}}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Model health timeout (180 s)');}
 catch(error){if(alive(child.pid))process.kill(child.pid,'SIGTERM');await rm(pidFile,{force:true});throw error;}
}else throw Error('Usage: model-server.mjs start [slug] | stop | status');
