# ScopeFence: release gates (for Johan)

**Hard deadline:** Sun 18 Oct 2026 23:59 PDT = **Mon 19 Oct 2026 14:59 SGT**. Aim to publish by **Mon 19 Oct 12:00 SGT** to leave a buffer.

The authorized main-Mac relay handles the private upload. The lead may review code and documentation. Public release, recording/uploading the video, personal statements and DEV publication remain Johan’s steps.

| # | Gate | How | Done? |
|---|---|---|---|
| 1 | Main pushed to the private repo | The main-Mac relay pushes `repository.bundle` to `Jo2234/hackathon-2026-dev-side-hustle` and verifies the commit | ☐ |
| 2 | Code review | Skim the README, `docs/eval-report.md` and `THIRD_PARTY_NOTICES.md`. Run `pnpm install && pnpm test` once if you like | ☐ |
| 3 | Make the repo **public** | GitHub → Settings → General → Danger Zone → Change visibility → Public. Required, because the post must link to or embed the code | ☐ |
| 4 | Record the video (≤ 2 min) | Follow `docs/demo-script.md`. Run `pnpm model:start` first, and turn Wi-Fi off during the analysis to show it is local. Do not show any real client data | ☐ |
| 5 | Upload the video | YouTube (unlisted is fine) or another host you choose. Copy the link | ☐ |
| 6 | Write your parts of the post | In `docs/post-draft.md`, replace every `[JOHAN: …]` placeholder in your own words. Fill "My First User" **only** with something that really happened; otherwise delete that section. Decide on "My Agent Session" (default: delete it, or describe the process in a sentence) | ☐ |
| 7 | Check the facts in the post | Eval numbers must match `docs/eval-report.md`; demo timings must match `docs/review-2-live.md` or the actual recording. Credit the build team for synthetic cases; describe only verified recording conditions and cuts. No invented testimonials, earnings or legal claims. Licence wording: Gemma 4 is Apache-2.0; llama.cpp is MIT | ☐ |
| 8 | Publish on DEV | Open the challenge's "Submission Template" link (dev.to/new prefilled), paste the post, keep `tags: devchallenge, hf26challenge`, add the video and repo links, and list **Best Use of Gemma** under Prize Categories. Publish **before 19 Oct 14:59 SGT** | ☐ |
| 9 | Post-deadline commits | If anyone commits after the deadline, add a line to the README section "Commit timeline and deadline note" | ☐ |

Eligibility reminders (from the official rules): you must be 18+; one entry per participant (only the first counts); the project must be brand-new and built inside the Entry Period (this repo's first commit is 16 Oct 2026).
