/** Structural §4 contracts while slot 2's src/domain exports are not on main.
 * Keep this module import-free from product code; eval uses only these fields.
 * Integration tests check the real pipeline/schema when those modules land. */
export type Label = 'included' | 'needs_clarification' | 'extra_work';
export type Basis = 'deliverable' | 'revision' | 'none';
export type Span = { start: number; end: number };
export interface RateCard {
  currency: 'SGD'|'USD'|'EUR'|'GBP'|'AUD'|'CAD'|'NZD'|'INR'|'MYR'|'PHP';
  hourly_rate_minor: number;
  effort_hours: {xs:number;s:number;m:number;l:number};
  deliverables: {id:string;name:string;price_minor:number;unit:string}[];
  revision_rounds_included: number; revision_rounds_used: number;
  freelancer_name: string; client_name: string; project_name: string;
}
export interface EvalCase {
  id: string; split: 'dev'|'test'; synthetic: true; note: string; title: string; tags: string[];
  brief: string; message: string; rate_card: RateCard;
  expected_items: {anchor:string;label:Label;clause_anchor?:string;included_basis:Basis;rationale:string}[];
  forbidden_included: string[]; expect_injection: boolean;
}
export interface AnalysisItem {
  id:string; request:string; message_quote:string; message_span:Span|null;
  model_label:Label; label:Label; reason:string; question:string; reason_codes:string[];
  model_clause_id:string|null; clause_id:string|null; brief_quote:string; brief_span:Span|null;
  citation_status:'verified'|'not_found'|'absent'; included_basis:Basis;
  deliverable_id:string; effort:'xs'|'s'|'m'|'l'|'none';
  pricing:{mode:'none'|'hourly'|'fixed';hours_hundredths:number|null;quantity:number};
  review:'proposed'|'approved'|'excluded'; edited:boolean; duplicate_of:string|null; injection_overlap:boolean;
}
export interface Analysis {
  id:string; reference:string; mode:'live'|'fixture';
  model:{id:string;file:string|null;runtime:string;provenance?:string};
  prompt_version:string; created_at:string; latency_ms:number; attempts:number;
  timings:{prompt_tokens:number;predicted_tokens:number;prompt_ms:number;predicted_ms:number}|null;
  input:{brief:string;message:string;rate_card:RateCard};
  truncated:{brief:boolean;message:boolean;brief_dropped_chars:number;message_dropped_chars:number};
  clauses:(Span & {id:string;text:string})[];
  injection:{suspected:boolean;spans:(Span & {pattern:string})[]};
  items:AnalysisItem[];
  warnings:{code:string;message:string;item_id?:string}[];
  raw_model_output:string;
}
export interface CaseError {code:string;message:string;attempts?:number;raw?:string}
