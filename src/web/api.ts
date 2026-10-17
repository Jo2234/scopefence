import type { Analysis, ErrorCode, RateCard } from '../domain';

export type Health = {
  ok: boolean; mode: 'live' | 'fixture';
  model: { status: 'ready' | 'loading' | 'unreachable'; id: string; file: string | null; runtime: string; is_gemma: boolean; registered: boolean };
  limits: { brief_chars: number; message_chars: number }; prompt_version: string;
};
export type ApiError = { code: ErrorCode; message?: string; raw?: string; attempts?: number; details?: { path: string; message: string }[] };
export class AnalyseError extends Error {
  constructor(public readonly error: ApiError) { super(error.code); }
}
export async function getHealth(signal: AbortSignal): Promise<Health> {
  const response = await fetch('/api/health', { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Health unavailable');
  return response.json() as Promise<Health>;
}
export async function analyse(input: { brief: string; message: string; rate_card: RateCard }, signal: AbortSignal): Promise<Analysis> {
  const response = await fetch('/api/analyse', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal,
  });
  const body = await response.json() as { analysis?: Analysis; error?: ApiError };
  if (!response.ok || !body.analysis) throw new AnalyseError(body.error ?? { code: 'internal' });
  return body.analysis;
}
export const errorCopy: Record<ErrorCode, string> = {
  invalid_input: 'Check the input fields and try again.',
  model_unreachable: 'Local model is not running. Start it in a terminal: pnpm model:start',
  model_busy: 'Another analysis is still running. Wait for it to finish.',
  model_timeout: 'The model took longer than 4 minutes. Try a shorter message or restart the model.',
  model_output_invalid: 'Gemma did not return valid structured output after 3 attempts.',
  fixture_missing: 'No recorded fixture matches these inputs. Load a synthetic demo or switch to live mode.',
  cancelled: 'Analysis cancelled. Your previous analysis and inputs have been kept.',
  internal: 'Something went wrong. Your inputs have been kept. Try again.',
};
