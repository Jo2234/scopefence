# Plan changes

## 2026-10-16 — slot 1 — package install policy

All requested pinned package versions installed. Chose concurrently 9.2.1 (latest installed 9.x). The first pnpm install exited with ERR_PNPM_IGNORED_BUILDS for esbuild@0.28.2. Used the documented `pnpm approve-builds esbuild --yes`; pnpm recorded `allowBuilds: { esbuild: true }` in pnpm-workspace.yaml. No other dependency build scripts are allowed. pnpm also automatically recorded its eight Vitest minimum-release-age exclusions in that file during the first install. Frozen install, typecheck, zero-test Vitest run, and build then passed.

## 2026-10-16 — slot 1 — disable runtime CORS

The b11687 help reports `--cors-origins` defaults to `*` and CORS credentials default to enabled. Its startup log confirmed this. Added `--cors-origins '' --no-cors-credentials` to prevent cross-origin access under §13. The runtime still emits an empty `Access-Control-Allow-Origin` header (confirmed with an Origin-bearing localhost health request); its CLI provides no header-removal flag. The application itself emits no CORS headers. These flags exist in the verified binary. Initial CPU G0 measurements used the original §11 flags; subsequent runs include these two additional flags.

## 2026-10-16 — slot 1 — fixture input binding

The frozen ModelAdapter completion request carries only prompts, while fixture keys must hash the exact analysed brief and message (which cannot be reconstructed from trimmed clauses). Added `FixtureAdapter.setInput(brief, message)` for the orchestrator to bind those texts before completing. The shared ModelAdapter request/result contract remains unchanged. Fixture provenance and model id are exposed by the fixture instance for Analysis metadata.

## 2026-10-16 — slot 1 — concurrently correction

S0 selected concurrently 9.2.1 before checking the registry. `pnpm view concurrently@9 version --json` returned 9.2.5, so changed the exact pin to 9.2.5 on the integrator branch to meet §12.1's latest-9.x requirement. S0 main retains its original scaffold until the lead approves the next merge.

## 2026-10-16 — slot 1 — process-name verification

The first contingency restart was refused because `pgrep -fl llama-server` matched the parent shell's command text containing that phrase, although no model server was running. Keep the required pgrep check but confirm each candidate's executable basename with `ps -o comm=`. Also check again after hashing and refuse stop if a stale pid points to an unrelated executable. This fixes the false positive without weakening the single-server rule.

## 2026-10-17 — slot 4 — E1 approval and total ordering

Plan §10.4's E1 wording asks for the order total to reflect an hours edit before approval, while §5.4 explicitly excludes every proposed row from `priceOrder` totals. The UI and E1 preserve the approved-only invariant: editing a proposed row changes its domain-computed proposed amount, the approved total stays zero, and approving all rows enables the exact hand-calculated total. E1 then edits the approved row twice and asserts both updated totals before downloading Markdown. No pricing rule or recorded fixture is changed.

## 2026-10-17 — slot 4 — supported Vitest resource flags

The lead-requested `pnpm exec vitest run --pool=forks --poolOptions.forks.maxForks=2` exits before running tests because pinned Vitest 4.1.12 rejects `--poolOptions`. Its local CLI help exposes `--maxWorkers` and `--no-file-parallelism`. Ran `pnpm exec vitest run --pool=forks --maxWorkers=2 --no-file-parallelism` instead: 23 files and 158 tests passed. This preserves the resource-policy cap without changing tests or dependencies.
