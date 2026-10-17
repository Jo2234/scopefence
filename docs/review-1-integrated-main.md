# Lead review 1: integrated main (17 Oct 2026, ~10:25 SGT)

**Tested commit:** `2b3c5490a96dc95ac3ef2a97136fe9189d891b70` (main), checked out in a separate detached review worktree by the lead.

## Commands run by the lead, and their results
| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | ok |
| `pnpm typecheck` | ok |
| `pnpm test` | **23 files, 158 tests passed**, 0 todo, 0 skipped |
| `pnpm build` | ok (dist/web, 222 kB JS) |
| `git log -p main` scan: keyword scan + token-shaped regex (sk-, ghp_, hf_, AKIA, xox, PRIVATE KEY) | no secrets; keyword hits are prose only |

Earlier, the same checks were run on `c967356`: 156/156 tests passed.

## Branch reviews (diffs read by the lead)
- **slot2 domain** (`5b43ecd`, then `a84621f`): reconcile R2–R12 in plan order; pricing uses integer minor units with half-up rounding and safe-integer guards; the HTML renderer escapes every interpolation and has no scripts or URLs; edits re-run the R9/R10 defaults. The follow-up fix lets a user overrule a false duplicate.
- **slot3 eval** (`836e59b`, then `8cca779`): 16 synthetic cases; gold labels reviewed against plan §8.2 and judged defensible. The realism change (no exclusion list in test-02/test-05) is applied. The report generator computes the case-design caveats.
- **slot1 model/server** (`c0471ec`, then `355a85a`): `analyse()` follows §4.10/§8.4 (zod re-validation with request-specific enums, a 3-attempt repair loop, reconciliation, sha256 reference, 240 s timeout, abort). G0 is documented with every run.

## Live status at this commit
- **Live integration verified (by slot 1, recorded in `docs/g0-report.md`):** Gemma 4 E2B Q4_0 in llama.cpp b11687 on CPU; schema-constrained JSON. `pnpm smoke:live` through the full `analyse()` path passed in 104.6 s wall (slower decoding under machine load; output length unchanged at 601 tokens).
- **Not yet verified by the lead:** live analysis in a browser (UI is in progress on slot 4); the live eval (in progress on slot 3).
- Known quality issue (measured, not hidden): on demo-1, E2B labelled the tagline revision as extra_work and the vague menu request as extra_work.
