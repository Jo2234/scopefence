# Third-party notices

ScopeFence's original code is MIT licensed, copyright (c) 2026 Johan Vaz. Third-party software and model weights retain their respective licences and copyright notices. They are not relicensed by ScopeFence. This repository does not vendor third-party source, runtime binaries or model weights.

## Local inference runtime

**llama.cpp**, ggml-org and contributors, build **b11687** (commit c80475452), is MIT licensed. The download script obtains the pinned macOS x64 release archive and verifies its SHA-256 before extraction. It is downloaded separately into the cache and is **not redistributed** in the repository. Preserve the upstream LICENSE supplied inside the downloaded archive.

- Source: https://github.com/ggml-org/llama.cpp
- Pinned licence: https://github.com/ggml-org/llama.cpp/blob/b11687/LICENSE
- Release: https://github.com/ggml-org/llama.cpp/releases/tag/b11687

## Gemma models

Google's Gemma models are the open-weight model family used by ScopeFence. GGUF conversions are obtained from the pinned ggml-org Hugging Face repositories. Weights are downloaded separately, verified by SHA-256 and never committed or redistributed here. This project does not fine-tune the models.

| Model | Pinned conversion revision | Licence |
|---|---|---|
| Gemma 4 E2B IT, Q4_0 (product) | ggml-org/gemma-4-E2B-it-GGUF @ b4243c156154b6dca9324415f8c7ccc098b4aed1 | Apache-2.0: https://ai.google.dev/gemma/docs/gemma_4_license |
| Gemma 3 1B IT, Q4_K_M (comparison) | ggml-org/gemma-3-1b-it-GGUF @ f9c28bcd85737ffc5aef028638d3341d49869c27 | Gemma Terms of Use: https://ai.google.dev/gemma/terms |
| Gemma 3 4B IT, Q4_K_M (optional) | ggml-org/gemma-3-4b-it-GGUF @ d0976223747697cb51e056d85c532013931fe52e | Gemma Terms of Use: https://ai.google.dev/gemma/terms |

The Gemma 4 licence differs from Gemma 3's terms. Exact files, URLs, sizes and hashes are recorded in src/model/models.json. The ggml-org conversion repositories and Google model/licence pages are the provenance references; no claim of Google sponsorship or endorsement is made.

## Direct npm dependencies

Versions below are pinned exactly in package.json and pnpm-lock.yaml. Licence metadata comes from the installed package manifests reported by pnpm. The packages keep their upstream notices and licence files in node_modules.

| Package | Version | Licence | Upstream attribution |
|---|---|---|---|
| @hono/node-server | 1.19.17 | MIT | Yusuke Wada |
| hono | 4.13.13 | MIT | Yusuke Wada |
| react | 19.3.1 | MIT | https://react.dev/ |
| react-dom | 19.3.1 | MIT | https://react.dev/ |
| zod | 4.6.7 | MIT | Colin McDonnell |
| @playwright/test | 1.64.1 | Apache-2.0 | Microsoft Corporation |
| @types/node | 24.19.2 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node |
| @types/react | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react |
| @types/react-dom | 19.3.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom |
| @vitejs/plugin-react | 5.2.0 | MIT | Evan You |
| concurrently | 9.2.5 | MIT | Kimmo Brunfeldt |
| fast-check | 4.10.2 | MIT | Nicolas DUBIEN |
| tsx | 4.23.15 | MIT | Hiroki Osame |
| typescript | 6.0.3 | Apache-2.0 | Microsoft Corp. |
| vite | 7.3.7 | MIT | Evan You |
| vitest | 4.1.12 | MIT | Anthony Fu |

## Transitive dependencies and data attribution

The complete installed inventory is [docs/licenses.json](docs/licenses.json), generated with `pnpm run licenses` (which runs `pnpm licenses list --json`). It records package names, installed versions, licence identifiers, upstream attribution and package paths. Regenerate it after dependency changes.

The installed inventory contains MIT, Apache-2.0, ISC, BSD-3-Clause, 0BSD and CC-BY-4.0 components. Preserve their supplied licence and copyright notices when redistributing a built application or dependencies. The inventory is an attribution record, not a substitute for the upstream licence texts.

- **caniuse-lite 1.0.30001816**, attributed to **Ben Briggs**, is licensed under **CC-BY-4.0**. Source: https://github.com/browserslist/caniuse-lite . Licence: https://creativecommons.org/licenses/by/4.0/ . It is installed without project modifications and used by the browser-compatibility build tooling.
- **source-map-js 1.2.2**, attributed to **Valentin 7rulnik Semirulnik**, is BSD-3-Clause licensed: https://github.com/7rulnik/source-map-js .
- **tslib 2.8.1**, Microsoft Corp., is 0BSD licensed: https://www.typescriptlang.org/ .
- Other Apache-2.0 components include Playwright, baseline-browser-mapping, expect-type and RxJS; the exact records are in the inventory. ISC components and their authors are also recorded there.

## Synthetic example material

The briefs, messages, rate cards and gold labels in this project are invented examples, not client data. Model-output fixtures retain their exact raw text and truthful recorded or hand-written provenance. No third-party client work, private correspondence or testimonials are included.
