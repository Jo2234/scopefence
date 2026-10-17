import {readdir, readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';
import {RateCardSchema} from '../src/domain/index.js';
import {analyse} from '../src/model/analyse.js';
import {LlamaServerAdapter} from '../src/model/llama-server.js';
import {fixtureKey} from '../src/model/fixture.js';
import {getModel} from '../src/model/models.js';
const adapter = new LlamaServerAdapter();
const model = getModel('gemma-4-e2b')!;
const health = await adapter.health();
if (health.status !== 'ready' || health.model_file !== model.file) throw Error('Start the product E2B model: pnpm model:start gemma-4-e2b');
await mkdir('fixtures/model-outputs', {recursive:true});
for (const file of (await readdir('fixtures/demo')).filter(f => f.endsWith('.json')).sort()) {
  const input = JSON.parse(await readFile(path.join('fixtures/demo', file), 'utf8'));
  if (input.synthetic !== true) throw Error('Only synthetic demo inputs may be recorded');
  const result = await analyse({brief:input.brief, message:input.message, rate_card:RateCardSchema.parse(input.rate_card)}, adapter);
  if (!result.ok) throw Error(`${file}: ${result.error.code} (${result.error.message})`);
  const {analysis} = result;
  if (analysis.model.file !== model.file) throw Error('Model identity changed during fixture recording');
  const key = fixtureKey(analysis.input.brief, analysis.input.message);
  const fixture = {
    key, provenance:`recorded: ${analysis.model.id}, llama.cpp b11687, prompt ${analysis.prompt_version}, ${analysis.created_at}`,
    model_id:model.slug, prompt_version:analysis.prompt_version,
    raw_text:analysis.raw_model_output, synthetic_input:true,
  };
  await writeFile(path.join('fixtures/model-outputs', `${key}.json`), JSON.stringify(fixture,null,2)+'\n');
  console.log(JSON.stringify({demo:file, key, latency_ms:analysis.latency_ms, attempts:analysis.attempts,
    model_file:analysis.model.file, reconciled_labels:analysis.items.map(i => i.label), provenance:fixture.provenance}));
}
