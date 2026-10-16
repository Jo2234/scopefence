# Plan changes

## 2026-10-16 — slot 1 — package install policy

All requested pinned package versions installed. Chose concurrently 9.2.1 (latest installed 9.x). The first pnpm install exited with ERR_PNPM_IGNORED_BUILDS for esbuild@0.28.2. Used the documented `pnpm approve-builds esbuild --yes`; pnpm recorded `allowBuilds: { esbuild: true }` in pnpm-workspace.yaml. No other dependency build scripts are allowed. pnpm also automatically recorded its eight Vitest minimum-release-age exclusions in that file during the first install. Frozen install, typecheck, zero-test Vitest run, and build then passed.

## 2026-10-16 — slot 1 — disable runtime CORS

The b11687 help reports `--cors-origins` defaults to `*` and CORS credentials default to enabled. Its startup log confirmed this. Added `--cors-origins '' --no-cors-credentials` to satisfy §13's no-CORS requirement. These flags exist in the verified binary. Initial CPU G0 measurements used the original §11 flags; subsequent runs include these two additional flags.

## 2026-10-16 — slot 1 — fixture input binding

The frozen ModelAdapter completion request carries only prompts, while fixture keys must hash the exact analysed brief and message (which cannot be reconstructed from trimmed clauses). Added `FixtureAdapter.setInput(brief, message)` for the orchestrator to bind those texts before completing. The shared ModelAdapter request/result contract remains unchanged. Fixture provenance and model id are exposed by the fixture instance for Analysis metadata.
