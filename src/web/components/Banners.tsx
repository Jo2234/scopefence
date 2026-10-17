import type { Analysis } from '../../domain';
import { errorCopy, type ApiError } from '../api';

export function ErrorBanner({ error, retry, disabled }: { error: ApiError; retry: () => void; disabled: boolean }) {
  return <div className="banner danger" role="alert"><p>{errorCopy[error.code]}</p>{error.details?.map((d, i) => <p key={i}>{d.path}: {d.message}</p>)}<button type="button" onClick={retry} disabled={disabled}>Retry</button>{error.raw !== undefined && <details><summary>Show raw output</summary><pre>{error.raw}</pre></details>}</div>;
}
export function Banners({ analysis, changed }: { analysis: Analysis; changed: boolean }) {
  const failures = analysis.items.filter(i => i.citation_status === 'not_found').length;
  const duplicates = analysis.items.filter(i => i.duplicate_of !== null && i.review === 'excluded').length;
  return <div className="banners">
    {changed && <p className="banner warning" role="status">Inputs changed since this analysis. Re-analyse to update.</p>}
    {analysis.injection.suspected && <p className="banner warning" data-testid="injection-banner" role="alert">This message contains text that looks like instructions to an AI ("{[...new Set(analysis.injection.spans.map(s => s.pattern))].join(', ')}"). ScopeFence treats it as client text only. Items marked included need your manual confirmation.</p>}
    {analysis.truncated.brief && <p className="banner warning">The brief was truncated: {analysis.truncated.brief_dropped_chars.toLocaleString('en')} characters were not analysed. Citations are still checked against your full brief.</p>}
    {analysis.truncated.message && <p className="banner warning">The message was truncated: {analysis.truncated.message_dropped_chars.toLocaleString('en')} characters were not analysed.</p>}
    {failures > 0 && <p className="banner warning">{failures} quoted {failures === 1 ? 'clause was' : 'clauses were'} not found in your brief. Check the evidence before approving.</p>}
    {duplicates > 0 && <p className="banner neutral">{duplicates} duplicate {duplicates === 1 ? 'row' : 'rows'} excluded from pricing.</p>}
    {analysis.items.length === 0 && <p className="banner warning">Gemma found no change requests in this message. Read it yourself before replying.</p>}
    {analysis.warnings.filter(w => !['no_items_found', 'duplicate', 'citation_not_found', 'truncated_input', 'injection_suspected', 'instruction_like_text'].includes(w.code)).map((w, i) => <p key={i} className="banner neutral">{w.message}</p>)}
  </div>;
}
