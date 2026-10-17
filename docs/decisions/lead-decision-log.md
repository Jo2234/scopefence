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
