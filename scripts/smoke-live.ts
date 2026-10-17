import {readFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {AnalysisSchema, RateCardSchema, segmentBrief} from '../src/domain/index.js';
import {analyse} from '../src/model/analyse.js';
import {LlamaServerAdapter} from '../src/model/llama-server.js';
import {getModel} from '../src/model/models.js';
const demo = JSON.parse(await readFile(new URL('../fixtures/demo/demo-1.json', import.meta.url), 'utf8'));
const adapter = new LlamaServerAdapter();
const health = await adapter.health();
if (health.status !== 'ready' || health.model_file !== getModel('gemma-4-e2b')!.file) {
  throw Error('Smoke requires the product model: pnpm model:start gemma-4-e2b');
}
const started = performance.now();
const result = await analyse({brief:demo.brief, message:demo.message, rate_card:RateCardSchema.parse(demo.rate_card)}, adapter);
if (!result.ok) {console.error(JSON.stringify(result)); process.exitCode = 1;}
else {
  AnalysisSchema.parse(result.analysis);
  if (!isDeepStrictEqual(result.analysis.clauses, segmentBrief(result.analysis.input.brief).clauses)) {
    throw Error('Analysis clauses differ from domain segmentation');
  }
  console.log(JSON.stringify({wall_ms:Math.round(performance.now()-started), ok:true, valid:true,
    reconciled_labels:result.analysis.items.map(i => ({id:i.id, request:i.request, model_label:i.model_label, label:i.label, review:i.review, reason_codes:i.reason_codes})),
    analysis:result.analysis,
  }, null, 2));
}
