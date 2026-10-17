import {createHash, randomUUID} from 'node:crypto';
import {
  truncateInputs, segmentBrief, detectInjection, reconcile, makeModelOutputSchema,
  RateCardSchema, type Analysis, type RateCard, type ErrorCode,
} from '../domain/index.js';
import {AdapterError, type ModelAdapter, type CompletionResult} from './adapter.js';
import {FixtureAdapter} from './fixture.js';
import {buildOutputSchema} from './output-schema.js';
import {SYSTEM_PROMPT, PROMPT_VERSION, buildUserPrompt, buildRepairPrompt} from './prompt.js';

export type AnalysisInput = {brief:string; message:string; rate_card:RateCard};
export type AnalysisResult =
  | {ok:true; analysis:Analysis}
  | {ok:false; error:{code:ErrorCode; message:string; attempts?:number; raw?:string}};

export async function analyse(
  input:AnalysisInput,
  adapter:ModelAdapter,
  opts:{signal?:AbortSignal; max_attempts?:number} = {},
):Promise<AnalysisResult> {
  const started = performance.now();
  const card = RateCardSchema.safeParse(input.rate_card);
  if (typeof input.brief !== 'string' || !input.brief.trim()
      || typeof input.message !== 'string' || !input.message.trim() || !card.success) {
    return {ok:false, error:{code:'invalid_input', message:'Brief, message and a valid rate card are required'}};
  }
  const timeout = AbortSignal.timeout(240000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  const failureOnAbort = () => {
    if (signal.reason instanceof AdapterError) return signal.reason;
    return new AdapterError(timeout.aborted ? 'model_timeout' : 'cancelled');
  };
  let onAbort:(()=>void)|undefined;
  try {
    if (signal.aborted) throw failureOnAbort();
    const {brief_analysed, message_analysed, truncated} = truncateInputs(input.brief, input.message);
    const {clauses, capped} = segmentBrief(brief_analysed);
    const injection = detectInjection(message_analysed);
    const originalPrompt = buildUserPrompt(clauses, message_analysed, card.data);
    const validator = makeModelOutputSchema(clauses.map(c => c.id), card.data.deliverables.map(d => d.id));
    const json_schema = buildOutputSchema(clauses, card.data);
    if (adapter instanceof FixtureAdapter) adapter.setInput(brief_analysed, message_analysed);
    const maxAttempts = Number.isFinite(opts.max_attempts)
      ? Math.max(1, Math.min(3, Math.floor(opts.max_attempts!))) : 3;
    let user = originalPrompt;
    let raw = '';
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(failureOnAbort());
      signal.addEventListener('abort', onAbort, {once:true});
      if (signal.aborted) onAbort();
    });
    for (let attempts = 1; attempts <= maxAttempts; attempts++) {
      const completion:CompletionResult = await Promise.race([
        adapter.complete({system:SYSTEM_PROMPT, user, json_schema, max_tokens:1100, temperature:0, seed:42, signal}),
        aborted,
      ]);
      if (signal.aborted) throw failureOnAbort();
      raw = completion.text;
      let parsed:unknown;
      let issues:Array<{message:string; path?:ReadonlyArray<PropertyKey>}> = [];
      try {parsed = JSON.parse(raw);}
      catch (error) {issues = [{message:`Invalid JSON: ${error instanceof Error ? error.message : 'Could not parse output'}`}];}
      const validated = issues.length ? null : validator.safeParse(parsed);
      if (validated?.success) {
        const reconciled = reconcile(validated.data, {
          brief_original:input.brief, brief_analysed, message_analysed,
          clauses, rate_card:card.data, injection,
        });
        const warnings:Analysis['warnings'] = [];
        if (truncated.brief) warnings.push({code:'truncated_input', message:`The brief was truncated: ${truncated.brief_dropped_chars} characters were not analysed. Citations are still checked against your full brief.`});
        if (truncated.message) warnings.push({code:'truncated_input', message:`The message was truncated: ${truncated.message_dropped_chars} characters were not analysed.`});
        if (capped) warnings.push({code:'truncated_input', message:'Only the first 120 brief clauses were analysed.'});
        warnings.push(...reconciled.warnings);
        const reference = 'SF-' + createHash('sha256')
          .update(input.brief + '\u0000' + input.message + '\u0000' + JSON.stringify(input.rate_card))
          .digest('hex').slice(0,8);
        const model:Analysis['model'] = {
          id:adapter instanceof FixtureAdapter ? adapter.model_id
            : completion.model_file?.replace(/\.gguf$/i, '').toLowerCase() ?? 'fixture',
          file:completion.model_file, runtime:adapter.mode === 'live' ? 'llama.cpp b11687' : 'fixture',
        };
        if (adapter instanceof FixtureAdapter && adapter.provenance) model.provenance = adapter.provenance;
        return {ok:true, analysis:{
          id:randomUUID(), reference, mode:adapter.mode, model, prompt_version:PROMPT_VERSION,
          created_at:new Date().toISOString(), latency_ms:Math.max(0, Math.round(performance.now()-started)),
          attempts, timings:completion.timings,
          input:{brief:brief_analysed, message:message_analysed, rate_card:card.data},
          truncated, clauses, injection, items:reconciled.items, warnings, raw_model_output:raw,
        }};
      }
      if (validated && !validated.success) issues = validated.error.issues;
      if (attempts === maxAttempts) return {ok:false, error:{
        code:'model_output_invalid', message:`Gemma did not return valid structured output after ${attempts} attempts.`, attempts, raw,
      }};
      user = buildRepairPrompt(originalPrompt, issues, raw);
    }
    throw new AdapterError('internal');
  } catch (error) {
    const failure = signal.aborted ? failureOnAbort() : error;
    if (failure instanceof AdapterError) return {ok:false, error:{code:failure.code, message:failure.message}};
    return {ok:false, error:{code:'internal', message:'Analysis failed'}};
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}
