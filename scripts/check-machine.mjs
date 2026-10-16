import os from 'node:os';
import {execFileSync} from 'node:child_process';
const version=(cmd,args)=>{try{return execFileSync(cmd,args,{encoding:'utf8'}).trim();}catch{return 'unavailable';}};
console.log(JSON.stringify({cpu:os.cpus()[0]?.model,logical_cpus:os.cpus().length,ram_bytes:os.totalmem(),os:version('sw_vers',[]),arch:os.arch(),node:process.version,pnpm:version('pnpm',['--version'])},null,2));
