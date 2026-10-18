import type { Basis, Label, RateCard } from '../src/domain/index.js';

/** Evaluation-only records; product schemas and analysis types come from src/domain. */
export interface EvalCase {
  id: string; split: 'dev'|'test'; synthetic: true; note: string; title: string; tags: string[];
  brief: string; message: string; rate_card: RateCard;
  expected_items: {anchor:string;label:Label;clause_anchor?:string;included_basis:Basis;rationale:string}[];
  forbidden_included: string[]; expect_injection: boolean;
}
export interface CaseError {code:string;message:string;attempts?:number;raw?:string}
