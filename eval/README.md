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

## Domain and offline integration checks

Case validation imports the product RateCardSchema directly. Metrics, runner and
test helpers import the product Analysis and AnalysisItem types; there are no
local domain fallbacks. The two-case analyse + ScriptedAdapter test always runs,
so a missing or incomplete orchestrator is a failing integration check.
Other runner tests use explicit dependency stubs to assert serial execution,
guards, saved metadata and continuation after a case error.

The report loads the full case corpus to derive its Case design caveats section:
explicit exclusion-list counts, message lengths (short means at most 100 words),
and longer-message ids and word counts. These caveats describe the invented,
build-team-labelled corpus even when a result file contains only one split.
No server or live eval is needed for any of these checks.

## Measured checkpoint (2026-10-17)

`protocol.json` records the registered D0, the pre-test pv1 freeze, the single
held-out run for each model, and the 1B dev comparison. D0 had no scored failures,
so zero of the two optional prompt iterations were used. The prompt stayed pv1;
existing pv1 demo fixtures were retained.

`observations.md` is the hand-written post-run section appended by the generator.
Regenerate and independently verify the measured report with:

```sh
pnpm eval:report
pnpm exec tsx eval/audit-results.ts
```

The audit imports no metric implementation. It independently checks exact quote
matching, counts, denominators, duplicate/spurious items, latency, split
completeness, AnalysisSchema validity, registry identity, historical prompt-file
hashes, and the held-out numbers printed in the report. Run results and raw model
text are committed; local execution logs under `eval/work/` are not deliverables.
Do not repeat either held-out split or change the frozen prompt for this checkpoint.

## Machine-load context amendment (no new model runs)

Future result JSONs include `cases[].machine_load.before` and `.after`, each an
`os.loadavg()` tuple in 1/5/15-minute order. Top-level `machine_load` records
`periods_minutes: [1,5,15]`, `sample_count`, and per-dimension `min`, `median`,
`max` across every before/after boundary sample, including failed cases. Full
numeric precision is retained in JSON. These additive fields are absent in the
four original files; no historical result was edited or given invented samples.

`machine-load-context.json` stores the lead's separately supplied uptime
snapshots, approximate swap usage and no-rerun decision. The report places that
historical context next to every original latency figure, including case rows.
Future reports use the runner's actual boundary samples and run summaries.
Snapshots do not establish individual case loads or an idle-machine latency.

Follow `control/RESOURCE-POLICY.md` and bound verification workers:

```sh
pnpm typecheck
pnpm exec vitest run --pool=forks --maxWorkers=2
pnpm eval:report
pnpm exec tsx eval/audit-results.ts
```
