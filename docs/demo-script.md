# ScopeFence demo video: script (≤ 2 min)

Historical proposed shot list. Johan authorized an AI production agent to record and edit the live demo on 18 October. Refer to the released video's production report for actual actions, timings and edits; the proposed numbers below are not recording evidence.

## Before recording (5 min)
1. `pnpm install` (once), then `export SCOPEFENCE_CACHE_DIR=…` if you use a custom cache, `pnpm runtime:fetch`, `pnpm model:download gemma-4-e2b` (once, 2.8 GB).
2. `pnpm build && pnpm model:start` (wait for "ready"), then `pnpm start` and open http://127.0.0.1:5178. **Live mode**: there must be **no** purple "FIXTURE MODE" bar. If you see one, you started the fixture server; stop it and use `pnpm start`.
3. Do one warm-up analysis of the demo, so that the model and prompt cache are warm (the first call is slower).
4. Browser window at 1280×800, zoom 100%, bookmarks bar hidden, notifications off. Close any tab showing real client data.
5. Keep remote-network access enabled. Show the local loopback runtime if useful; do not claim Wi-Fi was disabled.

## Shot list

| Time | On screen | Voice-over (suggested; say it your way) |
|---|---|---|
| 0:00–0:10 | Terminal: `pnpm model:status` → Gemma 4 E2B running; local loopback runtime evidence | "This is ScopeFence. It runs Gemma on this laptop. Inference uses the local runtime." |
| 0:10–0:25 | Click **Load synthetic demo**. Scroll briefly through the brief (bakery rebrand), the client message and the rate card (SGD 80/h, social kit 350, 2 revision rounds, 1 used) | "A made-up bakery client. Here's the brief they agreed to, their new message, and my own rates." |
| 0:25–0:35 | Click **Analyse with local Gemma**. The timer counts | "Gemma reads the message against the brief. On this 2019-era Intel CPU that takes about a minute…" |
| (cut) | Cut the wait. Put a caption with the actual measured wait omitted, e.g. "⏩ [measured seconds] of model wait skipped" | |
| 0:35–1:00 | The evidence table appears. Click the row with a ✓ verified quote: its clause lights up in the brief viewer. Show the actual labels and questions; if an ambiguous ask is marked extra, point out the mistake | "Code checks proposed included quotes word for word. Gemma can mislabel an ambiguous ask, so I review the labels as well as the questions." |
| 1:00–1:10 | Fix one row Gemma got wrong (e.g. change the menu-board hours from 1.5 to 3). The row's amount updates instantly (SGD 120.00 → 240.00) | "Gemma proposes; I decide. Prices come from my rate card, not from the model." |
| 1:10–1:25 | Click **Approve all remaining**. The approved total appears (SGD 630.00 with that edit; SGD 510.00 without it) | "Only rows I approve count." |
| 1:25–1:40 | Change-order panel: edit one sentence in the Markdown box → **Download .md** (includes that edit). Separately, show the table-derived HTML preview → **Download .html** or **Print** (does not include Markdown-only edits) | "Markdown keeps my text edits. HTML and print come from the approved table. Nothing is sent." |
| 1:40–1:55 | **Load injection demo** → Analyse (cut the wait) → the amber banner; the injected sentence is excluded; nothing is auto-included | "This tested injection is flagged and prevents automatic included labels. The detector covers known patterns, not every possible attack." |
| 1:55–2:00 | End card: "ScopeFence · Gemma 4 E2B + llama.cpp · MIT · github.com/Jo2234/scopefence" plus one line of the measured eval result | — |

## Rules
- Record the actual duration of each removed wait, including the injection analysis, and label every cut. Do not copy a planned duration into the finished video.
- **Don't stage results.** If Gemma labels a row differently in your take, keep it and correct it on screen. That *is* the product.
- Only the synthetic demo data appears. No real client names or emails.
- Use live mode for the video. If the model fails while recording, say so and re-take; do not switch to fixture mode without the purple bar visible.
- The numbers on the end card must equal `docs/eval-report.md`.
