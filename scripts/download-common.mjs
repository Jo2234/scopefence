import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, stat, rm, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
export const cache = path.resolve(process.env.SCOPEFENCE_CACHE_DIR ?? '.cache');
export async function hash(file) { const h=createHash('sha256'); for await(const chunk of createReadStream(file)) h.update(chunk); return h.digest('hex'); }
export async function verified(file, entry) { try { return (await stat(file)).size === entry.bytes && await hash(file) === entry.sha256; } catch { return false; } }
export async function command(cmd,args) { await new Promise((resolve,reject)=>{const child=spawn(cmd,args,{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${cmd} exited ${code}`)));}); }
export async function download(entry) {
 await mkdir(path.join(cache,'downloads'),{recursive:true});
 const dir=await mkdtemp(path.join(cache,'downloads',`${entry.slug}-${new Date().toISOString().replaceAll(':','-')}-`));
 const file=path.join(dir,entry.file);
 const url=entry.url ?? `https://huggingface.co/${entry.repo}/resolve/${entry.revision}/${entry.file}`;
 console.log(JSON.stringify({event:'download_start',slug:entry.slug,utc:new Date().toISOString(),file}));
 await command('curl',['-L','--fail','-C','-','--retry','3','--output',file,url]);
 if(!await verified(file,entry)){await rm(file,{force:true});throw new Error(`SHA256/size mismatch for ${entry.slug}; deleted download`);}
 console.log(JSON.stringify({event:'verified',slug:entry.slug,sha256:entry.sha256,utc:new Date().toISOString()}));
 return {dir,file};
}
export { mkdir, rm, rename, path };
