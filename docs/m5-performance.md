# M5 MacBook Air performance follow-up

Measured 18 October 2026 against application commit `c7a960943868b1418ffc533e181af1c9364399b4`. The application, model weights and frozen `pv1` prompt were unchanged. This is a small repeatability check of the synthetic bakery demo, not an accuracy evaluation or an isolated chip benchmark.

## Result

Five serial requests to the real `/api/analyse` endpoint took **11.0–12.1 seconds**, with an **11.4-second median**. Every response used live Gemma, passed the application's schema checks and succeeded in one attempt. No fixture output was used.

| Request | State | API wall time |
| --- | --- | --- |
| 1 | First request after fresh model start | 12.143 s |
| 2 | Warm repeat of identical input | 11.398 s |
| 3 | Warm repeat of identical input | 11.724 s |
| 4 | Warm repeat of identical input | 11.030 s |
| 5 | Warm repeat of identical input | 11.406 s |

Model startup to health readiness took **8.663 seconds**, separately from these request timings. “First request” does not mean the filesystem cache was cold. Warm requests benefited from llama.cpp's normal prompt cache: the first request processed 750 prompt tokens and the repeats processed five uncached tokens each. All generated 609 tokens. The four warm requests had an 11.402-second median.

## Configuration

- MacBook Air, Apple M5, 32 GB unified memory; model identifier Mac17,3.
- Official native macOS arm64 llama.cpp **b11687** (`b11687-c80475452`), with GPU offload requested using `-ngl 99`. The runtime lists `MTL0: Apple M5` as available.
- Same Gemma 4 E2B Q4_0 file as the Intel runs: `gemma-4-E2B-it-Q4_0.gguf`, SHA-256 `8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52`.
- Official arm64 runtime archive SHA-256 `f5abcc03d3a4d20a25b7080d617632fcdba5c8ceef2b075ef2879b5130cabe80`.
- Context 8192, four CPU threads, one slot, seed 42, reasoning budget zero. Product temperature, JSON schema, validation and reconciliation unchanged.
- Node 24.19.0; application dependencies installed from the frozen lockfile. Normal desktop apps remained open. No unrelated process was stopped.
- Exact unchanged input: `fixtures/demo/demo-1.json`. These are five repetitions of one case, not five distinct cases.

[Raw measurements and complete synthetic responses](performance/m5-demo-20261018.json) include input/prompt hashes, settings, per-run load samples and model timings. The initial held-out evaluation remains in [eval-report.md](eval-report.md); its accuracy claims have not been rerun or replaced by this performance check.

## Interpretation

The older timings came from a shared Intel Mac with 8 GB RAM and CPU inference. This M5 run uses native Apple Silicon and GPU offload, so it demonstrates performance on this configuration; it does not isolate CPU generation from memory, acceleration or background load. Browser rendering and human review time are outside the API measurement.

The published video still records the genuine Intel session: its measured 130.8-second analysis and labelled editing cuts are unchanged. The DEV article distinguishes that recording from these later M5 timings.

## Reproduce

Use the native arm64 asset from the [official b11687 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11687), verify the hashes above, and reuse the pinned model. The project's original `runtime:fetch` wrapper targets macOS x64; this follow-up launched the official arm64 binary directly:

```sh
/path/to/llama-server -m /path/to/gemma-4-E2B-it-Q4_0.gguf \
  --host 127.0.0.1 --port 8089 -c 8192 -t 4 -ngl 99 -np 1 \
  --jinja --reasoning-budget 0 --no-webui --seed 42 \
  --cors-origins '' --no-cors-credentials
SCOPEFENCE_MODE=live SCOPEFENCE_PORT=5278 pnpm exec tsx src/server/main.ts
```

After both servers report ready, send five serial JSON POSTs to `http://127.0.0.1:5278/api/analyse`, using `brief`, `message` and `rate_card` from `fixtures/demo/demo-1.json`. Measure elapsed monotonic wall time from request start through the fully read response, retain every result and stop the servers after measurement. Do not tune the prompt or select only the fastest run.
