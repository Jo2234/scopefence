# G0 local Gemma report

**G0: PASS** — the pinned Gemma 4 E2B Q4_0 loads in the verified llama.cpp b11687 macOS x64 runtime and returns independently validated structured JSON for demo-1. This gate does not establish label accuracy.

All inputs are invented, synthetic examples. No hosted model was used. These timing probes are not an eval or benchmark.

## Machine and verified downloads

- CPU: Intel(R) Core(TM) i5-8257U CPU @ 1.40GHz; 8 logical CPUs; 4 generation threads.
- RAM: 8589934592 bytes (8 GiB), shared with other work.
- OS: ProductName:		macOS; ProductVersion:		15.7.7; BuildVersion:		24G720; x64.
- Node: v24.22.0; pnpm 12.11.2.
- Build: `version: 0.7.0-dev (build 11687, commit c80475452)`; built with AppleClang 17.0.0.17000013 for Darwin x86_64.
- Runtime SHA-256: `b6a708060365918bfe694156a315a896b1da043a1e8409bcfd6be2f970054bc0` (11,703,294 bytes).
- E2B SHA-256: `8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52` (2,841,481,184 bytes), verified at 2026-10-16T10:02:53Z.
- 1B SHA-256: `8ccc5cd1f1b3602548715ae25a66ed73fd5dc68a210412eea643eb20eb75a135` (806,058,240 bytes), verified at 2026-10-16T10:03:32Z.
- Gemma 3 4B was not downloaded; E2B is supported and did not crash.

## Launch and help verification

The runtime was hash-verified before extraction and execution. Ran `llama-server --version` and `llama-server --help` first. The initial CPU flags were:

```sh
llama-server -m <cache>/models/gemma-4-E2B-it-Q4_0.gguf --host 127.0.0.1 --port 8089 -c 8192 -t 4 -ngl 0 -np 1 --jinja --reasoning-budget 0 --no-webui --seed 42
```

Subsequent starts add `--cors-origins '' --no-cors-credentials`. The GPU trial changes only `-ngl 0` to `-ngl 99` plus these CORS flags. `--cors-origins ''` disables usable cross-origin access but the runtime still emits an empty Access-Control-Allow-Origin header. Hono emits no CORS headers. The checked help excerpts are:

| Flag | b11687 help excerpt |
|---|---|
| -m, --model FNAME | model path to load |
| --host HOST | IP addresses to listen on, comma-separated, or UNIX socket paths |
| --port PORT | port to listen |
| -c, --ctx-size N | size of the prompt context |
| -t, --threads N | number of CPU threads to use during generation |
| -ngl, --gpu-layers N | max. number of layers to store in VRAM |
| -np, --parallel N | number of server slots |
| --jinja, --no-jinja | whether to use jinja template engine for chat |
| --reasoning-budget N | token budget for thinking: -1 for unrestricted, 0 for immediate end |
| --ui, --webui, --no-ui, --no-webui | whether to enable the Web UI |
| -s, --seed SEED | RNG seed |
| --cors-origins ORIGINS | comma-separated list of allowed origins for CORS (default: *) |
| --cors-credentials, --no-cors-credentials | whether to allow credentials for CORS (default: enabled) |

Cold CPU load (spawn to HTTP /health 200, excluding file hash verification): **12,521 ms**. GPU-flag load: **12,432 ms**. CPU restart for contingency experiments: **9,150 ms**. Only one llama-server ran at a time.

## Every demo-1 timing

All calls use temperature 0, seed 42, cache_prompt true, chat_template_kwargs.enable_thinking false. The default prompt is pv1, max_tokens 1100, maxItems 8. The shortened prompt is labelled pv1-g0-short and removes only the effort definitions; it is an experimental G0 contingency, not a production prompt change. The cap trial uses max_tokens 800; the six trial additionally uses maxItems 6.

| Configuration | Run | Wall ms | Prompt processed / cached | Predicted tokens | Prompt ms | Predicted ms | Predicted tokens/s | RSS after call, KiB | Schema valid |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| cpu | 1 | 74250 | 750 / 0 | 601 | 13375.175 | 60514.705 | 9.915 | 2178268 | yes |
| cpu | 2 | 65722 | 5 / 745 | 601 | 322.639 | 65324.898 | 9.185 | 1902244 | yes |
| cpu | 3 | 58916 | 5 / 745 | 601 | 292.951 | 58544.764 | 10.249 | 1807900 | yes |
| gpu | 1 | 109716 | 750 / 0 | 601 | 31882.325 | 77744.518 | 7.718 | 1932420 | yes |
| cpu-short | 1 | 77185 | 735 / 0 | 613 | 17783.785 | 59293.836 | 10.321 | 2519184 | yes |
| cpu-short-cap | 1 | 66359 | 5 / 730 | 607 | 352.439 | 65843.938 | 9.204 | 1946496 | yes |
| cpu-short-cap-six | 1 | 65651 | 5 / 730 | 607 | 333.629 | 65161.083 | 9.300 | 2007364 | yes |

The three default CPU runs have a median wall latency of **65,722 ms (65.722 s)**. Logical prompt length is 750 tokens in each default run; the second and third process only five new tokens with 745 cached. CPU RSS after load was **1,807,284 KiB (1.724 GiB)**. After calls it was 2,178,268, 1,902,244, and 1,807,900 KiB; the largest of those is **2.077 GiB**. A separate sample during prompt processing reached 2,621,032 KiB (2.500 GiB). RSS is process resident memory, not the model file size or total system memory.

- cpu: RSS before configuration 1806960 KiB (fresh load only for cpu, gpu, cpu-short, and 1b). Raw evidence: `$SCOPEFENCE_CACHE_DIR/logs/g0-cpu.json`.
- gpu: RSS before configuration 2787452 KiB (fresh load only for cpu, gpu, cpu-short, and 1b). Raw evidence: `$SCOPEFENCE_CACHE_DIR/logs/g0-gpu.json`.
- cpu-short: RSS before configuration 2866788 KiB (fresh load only for cpu, gpu, cpu-short, and 1b). Raw evidence: `$SCOPEFENCE_CACHE_DIR/logs/g0-cpu-short.json`.
- cpu-short-cap: RSS before configuration 2063492 KiB (fresh load only for cpu, gpu, cpu-short, and 1b). Raw evidence: `$SCOPEFENCE_CACHE_DIR/logs/g0-cpu-short-cap.json`.
- cpu-short-cap-six: RSS before configuration 2046516 KiB (fresh load only for cpu, gpu, cpu-short, and 1b). Raw evidence: `$SCOPEFENCE_CACHE_DIR/logs/g0-cpu-short-cap-six.json`.

## Constrained decoding and thinking

The default CPU response_format.json_schema conflict probe instructed the model to ignore the schema and output only BANANA. It returned exactly a JSON object with sentinel SCHEMA_OK (HTTP 200; 3,337 ms), matching the one-value schema. All three normal default outputs also pass the independent Zod validator, including request-specific clause and deliverable enums. Thus response_format.json_schema is honoured; no top-level json_schema or validate-only fallback was required.

Across the saved responses, message.content is JSON only with no reasoning text or think tags, and message.reasoning_content is absent. Thinking is disabled by both the server flag and the request template setting. This is observed response evidence, not a claim about unobservable internal computation.

## Quality and memory limitations

The default E2B output labels the tagline size change as extra_work despite the revision allowance, labels the vague premium menu-board request as extra_work, and emits the repeated social-kit wording as another needs_clarification item. G0 only establishes execution and valid structured output. Do not claim the synthetic demo has correct labels or semantic deduplication from this result. The exact first output is retained in fixtures/model-outputs/e71d125b1dc3f1cf.json with recorded provenance.

System-wide vm_stat showed active swapping: from the pre-CPU sample to the post-GPU sample, Swapins rose from 6,767,267 to 7,736,929 pages and Swapouts from 7,897,824 to 8,830,375 pages (4,096 bytes/page). These global deltas cannot be attributed solely to the model; RAM is shared. Servers were stopped between configurations, no Playwright browser was started, and live runs were serial. Measurements can vary with concurrent machine load.

## Operational checks and implementation status

- The initial background shell jobs did not survive their launcher; relaunched them as detached Node child processes with log file descriptors. Both downloads then completed and verified.
- The first contingency restart falsely matched its parent shell via pgrep -fl. Corrected by verifying candidate executable names with ps. A subsequent deliberate second-start attempt while pid 87039 was running was correctly refused. No second server was spawned.
- All pinned npm versions installed. pnpm initially blocked esbuild; only esbuild was approved with pnpm approve-builds esbuild --yes. concurrently was corrected from 9.2.1 to registry-reported latest 9.x 9.2.5.
- The server health, body limit, invalid-input envelope, adapter boundary, cancellation and prompt/schema unit tests run without a live model.
- Domain stage A is not on main at report preparation. analyse.ts explicitly imports the specified domain names but remains a pending integration stub. A18–A22 and four domain-dependent server cases are explicit it.todo entries. Full /api/analyse is not yet operational and is not claimed verified.
- smoke-live.ts currently has the authorised G0-only line splitter. Replace it with domain segmentBrief after stage A is merged.

## Decision

Keep **-ngl 0**: the single -ngl 99 trial took 109,716 ms versus the 74,250 ms cold CPU baseline, and the x64 archive contains CPU/BLAS backends but no Metal backend. This is one comparison under changing shared-machine load, not a general GPU benchmark. Production prompt remains pv1. Further decisions about model choice and prompt quality require the lead's dev-split evaluation.
