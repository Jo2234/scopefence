# Plan changes

## 2026-10-16 — slot 1 — package install policy

All requested pinned package versions installed. Chose concurrently 9.2.1 (latest installed 9.x). The first pnpm install exited with ERR_PNPM_IGNORED_BUILDS for esbuild@0.28.2. Used the documented `pnpm approve-builds esbuild --yes`; pnpm recorded `allowBuilds: { esbuild: true }` in pnpm-workspace.yaml. No other dependency build scripts are allowed. pnpm also automatically recorded its eight Vitest minimum-release-age exclusions in that file during the first install. Frozen install, typecheck, zero-test Vitest run, and build then passed.
