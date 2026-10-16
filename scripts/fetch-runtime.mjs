import registry from '../src/model/models.json' with { type: 'json' };
import { cache, verified, download, mkdir, rename, rm, path, command } from './download-common.mjs';
const entry=registry.find(x=>x.slug==='runtime');
const target=path.join(cache,'runtime','llama-b11687');
const archive=path.join(target,entry.file);
if(await verified(archive,entry)) console.log(`Already verified: ${target}`);
else {
 const {dir,file}=await download(entry);
 const extracted=path.join(dir,'extracted');await mkdir(extracted);
 await command('tar',['-xzf',file,'-C',extracted]);
 await rename(file,path.join(extracted,entry.file));
 await mkdir(path.dirname(target),{recursive:true});await rm(target,{recursive:true,force:true});await rename(extracted,target);
 console.log(`Ready: ${target}`);
}
