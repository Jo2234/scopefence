# Lead decision log (Opus 5.5 project lead)

Owned by the lead; workers record their deviations in `plan-changes.md`.

## 2026-10-17 10:15 SGT: G0 result and latency decision
- **G0 passed** (slot 1, `docs/g0-report.md` on `codex/slot1-integrator` @ c0471ec): Gemma 4 E2B Q4_0 in llama.cpp b11687, CPU, schema-valid JSON on demo-1; `response_format.json_schema` is honoured; thinking is off.
- **Latency:** E2B demo-1 wall times were 74.3 / 65.7 / 58.9 s (median 65.7 s), above the plan's ~60 s target. Almost all of it is generation (~600 output tokens at ~9–10 tok/s); the prompt is cached after the first call.
- The §16 mitigations were tried in G0, in order. None gave a material gain: `-ngl 99` was slower (109.7 s; the x64 build has no Metal backend); the shorter prompt took 77.2 s cold; `max_tokens 800` took 66.4 s; 6 items max took 65.7 s. Gemma 3 1B is about 3× faster (median 20.1 s) but **dropped requests** (it omitted the tagline request in both warm runs and mis-associated quotes).
- **Decision:** the product and demo model stays **Gemma 4 E2B, prompt pv1**, with the visible elapsed-time loading state the plan already specifies. Latency is reported exactly as measured. Gemma 3 1B is run on the same eval as a comparison, and its omissions are reported, not hidden. Prompt iterations on the dev split may shorten the `reason` and `question` text (fewer output tokens); any latency change is reported from measurement.
- **Gold-label review** (slot 3 @ 836e59b): 16 cases reviewed. The labels are defensible under the §8.2 definitions. Change requested before the live run: remove the explicit "Out of scope" line from test-02 and test-05, because every brief having an exclusion list naming the extra item is unrealistically easy. The report must disclose that most briefs contain exclusion lists.
- **Domain review** (slot 2 @ 5b43ecd): reconcile R2–R12 and pricing match the plan; 61 tests pass (re-run by the lead). One follow-up: re-including an excluded duplicate must clear `duplicate_of`, otherwise a false dedupe can never be priced.
- **Merges approved:** `codex/slot2-domain@5b43ecd`, `codex/slot1-integrator@c0471ec` and `codex/slot3-eval@836e59b` into main, in that order (slot 1 performs them).

## 2026-10-17 10:40 SGT: Resource policy and latency labelling
- Machine snapshot during slot 3's live eval: `uptime` load averages **44.45 / 43.18 / 29.74** on 8 logical CPUs; swap 4.89 / 6.14 GB used. Load came from llama-server (~178% CPU) plus other sessions' Node/vitest jobs and the T3 app.
- **Latency numbers from runs made under this load are not benchmarks.** `eval-report.md` must show the load next to every latency figure.
- Label accuracy and citation metrics are unaffected by load (temperature 0, seed 42), so the frozen held-out accuracy runs stand.
- **Planned:** one E2B test-split **timing rerun in a quiet window** (no other heavyweight jobs; load recorded per case by the runner). The report labels it "quiet-machine timing run". Its labels also serve as a determinism check against the frozen run; any differences are reported.

## 2026-10-17 11:00 SGT: Live eval review and the latency gate
- Reviewed slot 3's live eval (`codex/slot3-eval@a42d7d1`): pre-registered protocol followed; pv1 frozen after D0 (dev 6/6 system labels, so 0 of 2 iterations were used); each test split ran once per model; no retries.
- **Held-out (10 cases, 14 gold items):** Gemma 4 E2B system labels 10/14, citations 9/10, clarification recall 1/3, injection resisted 1/1, JSON valid first try 10/10, median 34.8 s / p90 46.4 s. Gemma 3 1B: labels 1/14 (many missed or spurious items); its raw label obeyed the test-05 injection, and the deterministic layer neutralised it.
- **Latency gate:** E2B meets the ~60 s target on these cases **even under load averages of ~29–44**, so the planned quiet-machine rerun is cancelled (the decision doesn't depend on it). Latency is reported with its load context and is not presented as a benchmark.
- E2B remains the product model; 1B is documented as a failed lighter alternative.

## 2026-10-18 15:03 SGT — GPT-6 Astra HIGH quota fallback, existing lead

- Resumed thread `5ad14fd7-90f6-415e-b763-9cd090517ddf`, job `control/jobs/dev-opus.json`, after the fresh post-reset `usage_limit` recorded at 07:02 UTC. Actual provider/model: `codex` / `gpt-6-astra`, high effort. No replacement lead, worker or scheduler.
- Reviewed root/control policies, accepted decisions, frozen detailed plan, current clean main `238a24b`, existing worker/lead job records and release handoff. Private-upload receipt now verifies `238a24b`; the old export’s “awaiting relay” statement was stale.
- All four existing Sol HIGH workers were accepted and settled by the coordinator at 12:38 SGT; DEV currently has zero allocated active workers. Preserve those identities and request reallocation only if a concrete app/test fix is found.
- Accepted the independent reviewer’s three early release-document findings. Corrected team authorship, recording claims, and Markdown/HTML choreography; see plan-changes entry. Johan’s personal reflections remain placeholders.
- Independent review of pinned `238a24b` continues in reviewer thread `6aa97663-2029-48aa-b147-99d0c3a957b4`. This lead’s quota fallback is not that review or a submission pass. No final independent verdict is inferred.
