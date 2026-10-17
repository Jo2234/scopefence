# ScopeFence

ScopeFence uses local Gemma to map a freelance designer's client requests to the agreed brief, verify cited clauses, and prepare a deterministically priced change order for review.

Status: in development. The domain, model/server pipeline and offline eval runner are integrated; UI and live evaluation release gates are tracked separately.

Every example is invented and labelled synthetic. Nothing is sent to a client. A person must review each row and the final change order. This is not legal advice.

## Install and run locally

The tested environment is an Intel x86_64 Mac, macOS 15.7, 8 GB RAM, Node 24.22 and pnpm 12.11.2. The pinned runtime download is for macOS x64. Allow several GB of disk space for the runtime and model cache. Only one llama-server should run at a time; avoid running Playwright while a model is loaded on an 8 GB machine.

```sh
pnpm install --frozen-lockfile
pnpm runtime:fetch
pnpm model:download gemma-4-e2b
pnpm model:start gemma-4-e2b
pnpm smoke:live
pnpm dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the local Hono server on port 5178. The model listens on `127.0.0.1:8089`. The application has no hosted fallback.

Downloads are pinned by revision, byte count and SHA-256 in [the registry](src/model/models.json). Scripts use resumable curl downloads into a new cache directory, verify the file before extracting or using it, and delete a mismatched file. The default cache is `<repo>/.cache`; runtime binaries and weights are never committed. `pnpm model:start` rechecks hashes, refuses another running llama-server, and waits for health readiness. Logs and the pid file are under the cache.

```sh
pnpm model:status
pnpm model:stop
```

For a production-style local server, build first, then open `http://127.0.0.1:5178`:

```sh
pnpm build
pnpm start
```

The server remains bound to `127.0.0.1` in both modes.

## Fixture mode and configuration

Fixture mode replays an exact recorded output for a known brief/message pair. It makes no live model call and never invents an output for a missing key. The response identifies fixture mode and includes the recording provenance. An unknown input returns `fixture_missing`.

```sh
pnpm dev:fixture
```

The two synthetic demos live in `fixtures/demo`. Recorded raw outputs live in `fixtures/model-outputs`. To regenerate both from the product E2B model:

```sh
pnpm model:start gemma-4-e2b
pnpm fixtures:record
pnpm model:stop
```

The recording command uses the same truncation, prompt, validation, repair and reconciliation pipeline as the API. The fixture key hashes the analysed brief and message, separated by a NUL character.

| Environment variable | Default | Purpose |
|---|---|---|
| `SCOPEFENCE_MODE` | `live` | `live` or `fixture`; scripted test adapters cannot be selected here |
| `SCOPEFENCE_FIXTURE_DIR` | `<cwd>/fixtures/model-outputs` | Directory of keyed fixture JSON files; relative paths resolve from the working directory |
| `SCOPEFENCE_PORT` | `5178` | Application port, integer 1–65535; host stays `127.0.0.1` |
| `SCOPEFENCE_LLM_URL` | `http://127.0.0.1:8089` | Local HTTP llama-server endpoint; nonlocal URLs and redirects are rejected |
| `SCOPEFENCE_CACHE_DIR` | `<cwd>/.cache` | Verified runtime/model downloads, logs and pid files |
| `SCOPEFENCE_GPU_LAYERS` | `0` | Runtime control accepts `0` or `99`; the measured product setting is `0` |

For an isolated fixture server, including end-to-end test setups:

```sh
pnpm build
SCOPEFENCE_MODE=fixture SCOPEFENCE_FIXTURE_DIR=/absolute/path/to/fixtures SCOPEFENCE_PORT=5278 pnpm start
```

Open `http://127.0.0.1:5278`. The Vite development proxy targets 5178; use the default application port for `pnpm dev`, or use the built server when overriding the port.

## Checks and evaluation

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check:machine
pnpm run licenses
```

`pnpm test` covers domain invariants, prompts, dynamic enums, repair/refusal handling, fixture lookup, HTTP concurrency, cancellation, limits and the offline eval runner. It needs no live model. `pnpm run licenses` writes `docs/licenses.json`; pnpm also has a built-in `licenses` command, so `run` selects the repository script explicitly.

`pnpm smoke:live` requires E2B and exercises the full analysis pipeline on the synthetic demo. It prints actual wall latency, the registered filename, reconciled labels and schema-validated Analysis. Syntactically valid output can still classify requests incorrectly; check the raw output and quoted evidence before approving anything.

The eval runner supports serial live runs and clearly labelled, gold-derived offline plumbing checks. Follow [the eval instructions](eval/README.md) and the lead's split/prompt freeze protocol. Do not tune on held-out cases.

```sh
pnpm eval -- --model gemma-4-e2b --split dev
pnpm eval:report
```

`pnpm test:e2e` is the UI slot's Playwright command. UI/browser acceptance and the held-out live eval are separate gates; passing unit tests does not establish those results.

## Model and runtime records

| Registry slug | File / runtime | Role | Licence |
|---|---|---|---|
| `runtime` | llama.cpp b11687, macOS x64 | Local inference server; downloaded by script, not redistributed | [MIT](https://github.com/ggml-org/llama.cpp/blob/b11687/LICENSE) |
| `gemma-4-e2b` | `gemma-4-E2B-it-Q4_0.gguf` (2,841,481,184 bytes) | Product and demo model | [Apache-2.0](https://ai.google.dev/gemma/docs/gemma_4_license) |
| `gemma-3-1b` | `gemma-3-1b-it-Q4_K_M.gguf` (806,058,240 bytes) | Comparison; no automatic fallback | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |
| `gemma-3-4b` | `gemma-3-4b-it-Q4_K_M.gguf` (2,489,757,856 bytes) | Optional comparison; not downloaded by default | [Gemma Terms of Use](https://ai.google.dev/gemma/terms) |

The [G0 report](docs/g0-report.md) records the exact flags, verified hashes, structured-output checks and every timing. On the tested shared 8 GB Intel machine, the three original E2B demo runs took 74.250 / 65.722 / 58.916 seconds (median 65.722 s). The faster 1B warm runs omitted a request. The lead kept E2B with prompt `pv1`; no G0 prompt experiment was adopted. These synthetic probes are not an accuracy benchmark.

## Privacy and safeguards

- Briefs, messages and rate cards go only to the local application and local llama-server. Inference does not require internet access after package/runtime/model installation.
- No API keys are read or required. There are no hosted models, accounts, payments, sending, analytics, telemetry, external fonts or CDNs.
- The application does not persist or log briefs and messages. Local model/runtime logs are in the cache; the synthetic smoke and recording scripts intentionally print test outputs for inspection.
- The app, Vite and model bind to loopback. The app emits no CORS headers. The runtime is configured with no usable cross-origin permission; this build still emits an empty CORS origin header, as recorded in the G0 report.
- Only the first 8,000 brief characters and 4,000 message characters are analysed, cutting at a nearby word boundary when possible. Citations are checked against the full original brief; truncation and clause-cap warnings are returned.
- Every included verdict needs a verified exact quote unless the person reviewing overrides it. The deterministic layer checks request quotes, flags instruction-like client text, and excludes detected duplicates. Nothing is auto-approved.
- Money comes only from the user's rate card and deterministic domain code. Model output never supplies prices or hours.
- The browser persistence contract saves only the rate card under `scopefence.rate_card.v1`, with a forget action; briefs and messages must not be persisted. UI acceptance is tracked separately.
- `.gitignore` excludes dependencies, build output, local caches, weights, archives, environment files, logs and browser test output. The repository remains private until Johan's release gate.

## Credits and release status

ScopeFence code is [MIT licensed](LICENSE). Runtime, model and dependency credits are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), with the installed npm inventory in [docs/licenses.json](docs/licenses.json). Synthetic fixtures are recordings or explicitly marked hand-written test fixtures; there are no real clients, testimonials or user-research claims.

Public release, the video demo and the DEV submission are manual gates in [docs/release-gates.md](docs/release-gates.md).

## Commit timeline and deadline note

Project started 16 Oct 2026 (inside the Entry Period that began 12 Oct 2026 12:00 PDT). Submission deadline 18 Oct 2026 23:59 PDT. Commits after the deadline: none yet.
