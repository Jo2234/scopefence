import registry from '../src/model/models.json' with { type: 'json' };
import { cache, verified, download, mkdir, rename, path } from './download-common.mjs';
const entry=registry.find(x=>x.slug===process.argv[2] && x.slug!=='runtime');
if(!entry) throw new Error('Usage: download-model.mjs gemma-4-e2b|gemma-3-1b|gemma-3-4b');
const target=path.join(cache,'models',entry.file);
if(await verified(target,entry)) console.log(`Already verified: ${target}`);
else { const {file}=await download(entry);await mkdir(path.dirname(target),{recursive:true});await rename(file,target);console.log(`Ready: ${target}`); }
