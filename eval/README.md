# ScopeFence synthetic evaluation

All 16 cases are invented, with six development cases and ten held-out cases.
The labels require lead review before any live run. Do not tune on the test split.
The fixture demo is separate from this corpus.

## Commands

```sh
export SCOPEFENCE_CACHE_DIR=/Users/johanvaz/Documents/Codex/2026-10-04/i-w/outputs/t3code-data/scratch/hackathon-workflow-20261016/cache/dev
# Only after lead approval and the domain/model modules are merged:
pnpm eval -- --model gemma-4-e2b --split dev
pnpm eval -- --model gemma-4-e2b --split test
pnpm eval:report

# No server, model weights, hash read or network request:
pnpm eval -- --model gemma-4-e2b --split dev --case dev-01-revision-allowance --case dev-02-new-deliverable --dry-run
```

`--case` can be repeated; selection must belong to the chosen split. `--out`
changes the results directory. Live cases run serially after the `/props` model
identity and streamed local SHA256 checks pass. If `/props` supplies an absolute
model path, it must identify the file being hashed in the configured cache.
Setup errors exit 2. A per-case error is recorded and the next case still runs;
a run with per-case errors exits 0 because it successfully recorded those errors.
Every missed gold item remains in the label denominators.

Dry-run outputs are explicitly gold-derived, hand-written canned JSON passed to
`ScriptedAdapter` and the real `analyse()` pipeline. They test plumbing, not model
quality. They are stored under `eval/results/dry-run/`; `eval:report` ignores dry
runs even if a file is moved into the live results folder. No numeric
`docs/eval-report.md` is written until live results exist.

## Metric conventions

`metrics.ts` implements frozen plan §10.6. Indices are half-open UTF-16 spans.
Matching is greedy in gold order, then prediction order, and requires overlap
with at least half the gold anchor. Raw and reconciled labels are scored
separately. Clause correctness needs any positive overlap with the gold clause.
Raw non-empty brief quotes are checked character for character, even if too short
to qualify as evidence during reconciliation.

A spurious item has no eligible gold anchor. An excluded duplicate or injection
artifact is ignored for that count. A duplicate leak counts gold items with more
than one non-excluded eligible prediction. Injection safety examines every
prediction, including extra unsafe predictions beyond the greedy winner.

Rates store numerator, denominator and an unrounded ratio; a zero denominator
has `value: null`. Aggregation sums numerators and denominators (micro-average).
JSON valid by final attempt includes first-attempt successes. Case errors count
as unsuccessful JSON outcomes. Missing error attempt counts are `null` and use
an `unknown` histogram bucket rather than invented measurements.
Latency includes failed cases, uses the arithmetic median and nearest-rank p90.
Generation tokens/second uses reported prediction time, not wall time. Repeated
runs and prompt versions stay separate in the report. Unknown runtime build or
server flags are stored as `null`; the pinned expected build is a separate field.

## Integration status of the offline checkpoint

The scaffold main did not yet export `src/domain/index.ts`, `analyse.ts`,
`llama-server.ts`, `scripted.ts`, or `prompt.ts`. `types.ts` therefore holds the
structural §4 contracts and `cases.ts` has a temporary local §4.2 rate-card
validator. The tests automatically use `RateCardSchema` and the real two-case
ScriptedAdapter pipeline when those exports land; until then exactly those two
checks remain TODO. Other runner tests use explicit dependency stubs and assert
serial execution, guards, saved metadata and continuation after a case error.
They do not claim product integration. No server was started and no live eval
was run for this checkpoint.
