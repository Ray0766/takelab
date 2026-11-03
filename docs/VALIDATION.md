# Quality integration validation · 2026-11-03

Latest continuation: [strict synchronization gate and clean-install/static-host verification](RELEASE_CHECK_2026-11-03.md). It retains six diagnostic/gate trials and fixes demo seeking on hosts without HTTP byte-range support. Earlier measurements below remain historical evidence, including the missed 80 ms target.

Latest final check: **29 unit tests and 12 browser tests passed (44.9 seconds for the browser suite)**, production build and formatting passed. The strict three-trial gate passed separately, and three production workflows passed on the independent clean-install build served by a plain static server.

Remote `589d202` was merged into the implementation as `f959d19`; existing code and README documentation were retained. The working tree was clean before merging. No push, remote CI or deployment was performed.

## Current result

- **29 unit tests passed**; strict TypeScript and production build passed. Runtime licenses included.
- **9 browser functional workflows passed**, plus **1 optional 1080p benchmark** passed its regression guards. The final decision and benchmark checks ran separately after test instrumentation/output fixes. The stricter p95 quality target did not pass every run; see below.
- Formatting and `git diff --check` passed. Generated evidence is excluded from formatting to preserve actual exports.
- Desktop 1440×1000, Chinese 390×844 and 720×500 (200%-zoom-equivalent CSS workspace) checked without horizontal overflow. Decision textarea → evidence checkbox keyboard focus verified; reduced-motion preference enabled. This is not an actual browser-zoom or screen-reader audit.
- New secondary text / time link / selected heading contrast: **7.29:1 / 8.77:1 / 8.65:1** against their dark surfaces. No full WCAG conformance claim.

Environment: Windows 11 Pro, Core Ultra 9 285K, 63.3 GiB reported physical memory, RTX 5090 present, Node 24.18.0, Playwright Chromium **156.0.8078.4** (headless). GPU presence does not establish which hardware decoding path Chromium used. This is not a typical-laptop benchmark.

## Decision → evidence → generation record

The actual browser flow in `tests/e2e/decision.spec.ts` imports `orbit-04.mp4` and `orbit-07.mp4`, records the first clip's midpoint flicker at source **3.000 s**, rejects it, chooses 07 and links 04's observation to the winner's written rationale. Clicking the evidence reveals the rejected source even when filtered out and seeks to the observation. Opening the winner's record displays its own recipe.

The test exports and inspects JSON/Markdown IDs, source time and prompts; restores the metadata ZIP; verifies missing media; rejects a wrong relink without changing the record; relinks originals; reloads and checks persisted evidence. A full backup's embedded source bytes are then compared with the originals. Blind mode hides the written decision record. Missing model/seed/cost values remain “Not recorded.”

Reviewable outputs (original synthetic demo, not genuine model results):

- [Full portable selection package](evidence/decision-with-media.takelab.zip), including both source videos. Import through Project menu → Open project; export the current workspace first if it contains work to keep.
- [Readable production record](evidence/record.md), [structured record](evidence/project.json). These are the pre-relink snapshot; stable decision IDs are unchanged in the full backup.
- [Actual comparison video](evidence/decision-comparison.webm), [decoded frame at 3 s](evidence/comparison-frame.png).
- [Desktop](evidence/decision-desktop.png), [Chinese narrow layout](evidence/decision-mobile-zh.png), [zoom-equivalent layout](evidence/decision-zoom-equivalent.png).

FFprobe decoded the comparison as **VP9, 1280×444, 6.012 s, 140 frames, 589,486 bytes**, without decoder/container warnings. Video labels show full take IDs matching the report. This is silent real-time capture, not a 144-frame exact master.

The verified advantage over a folder/player/notes workflow is an explicit exportable relationship; the user need not manually reconstruct which filename, observation and recipe support a winner. **No timed human comparison or user study was performed.** Faster/better choices and willingness to maintain recipes remain hypotheses. Frame.io and Resolve already provide mature comparison/annotation capabilities; see [decisions and references](DECISIONS.md).

## Synchronization measurements

Protocol was set in DECISIONS.md before measurement. Original H.264 test patterns: 1920×1080, 24 fps / 8 s and 30 fps / 5 s, AAC audio, second source offset 0.5 s. Samples every 50 ms after 350 ms warm-up; seeking/buffering/ended samples excluded from steady spread. Raw samples and callback ages are retained. These short runs do not establish sustained production performance.

| Scenario   | Baseline presented p95 / max | Final presented p95 / max  | Final clock p95 | Frames / dropped, per player |
| ---------- | ---------------------------- | -------------------------- | --------------- | ---------------------------- |
| Single, 1× | Pair spread not applicable   | Pair spread not applicable | —               | 60 / 0                       |
| Dual, 1×   | 66.7 / 66.7 ms               | 58.3 / 58.3 ms             | 0.084 ms        | 73 / 0; 91 / 0               |
| Dual, 0.5× | 25.0 / 33.3 ms               | 25.0 / 33.3 ms             | 0.066 ms        | 36 / 0; 45 / 0               |
| Dual, 2×   | **233.3 / 258.3 ms**         | **58.3 / 58.3 ms**         | 9.649 ms        | 96 / 2; 120 / 0              |
| After loop | 58.3 / 58.3 ms               | 66.7 / 66.7 ms             | 4.616 ms        | 37 / 0; 46 / 0               |

The baseline repeatedly sought decoders at 2× while its independent wall clock outran media startup. Following the longest available source's actual media clock removed that regression in this fixture. Frame counters fell from 405 / 225 to 96 / 120 during the 2-second 2× window; these counters include repeated decode work, not unique source-frame coverage.

**Retained non-pass:** [another corrected-build run](evidence/sync-after-run2.json) measured **83.3 ms p95 at 1×**, above the **80 ms target**. Its clocks were within 1 ms, but callbacks could be 101 ms old. The final run met the target; it is **not consistently established**. The test records target status separately from regression bounds (clock p95 ≤100 ms, presented maximum ≤150 ms). Passing those guards does not erase a missed quality target. Frame callbacks are an approximate observation, not an external screen/camera measurement. Do not advertise frame-locked playback.

Final paused seek: clocks settled in **146 ms**, requested presented frames observed by **153 ms**, at source times **2.000 / 2.500 s**, the same review moment. Nominal stepping, only-selected-take audio flags, shorter-source final-frame hold, longer-source continuation, non-loop ending and loop passed. Audio routing was checked programmatically; perceptual listening/lip-sync was not measured. Loop steady alignment was measured; exact 750 ms reacquisition latency was not independently timed.

Chromium reported about **24.5 MB JS heap** in final sample windows. This excludes decoder/GPU memory and is not total-memory or leak certification. Drop counts varied across runs, especially at 2×. The 9-way regression uses 640×360 clips; it does not establish 9×1080p capacity.

Receipts: [baseline](evidence/sync-before.json), [final](evidence/sync-after.json), [1080p screenshot](evidence/sync-1080p.png).

## Reproduce and boundaries

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
# Optional host benchmark; FFmpeg must be on PATH:
node scripts/generate-sync-fixtures.mjs
npx playwright test tests/e2e/sync.spec.ts
npx playwright test tests/e2e/decision.spec.ts
npm run format:check
ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,nb_read_frames -show_entries format=duration,size -of json docs/evidence/decision-comparison.webm
```

Without generated fixtures, the host benchmark is explicitly skipped. Copy evidence before another test run cleans `test-results/`. Vite excludes test output and `.local` from watching: Windows locked a `.crdownload` file and crashed the development watcher during verification; this was observed and repaired.

Existing workflows still cover nine-way playback, stepping, offsets, one winner, pagination, blind mode, persistence, source/reference ZIP restoration, invalid archives, undecodable files, removal and export cancellation. The production-subpath result below predates this change and is not a new deployment check.

Remaining limits: ordinary-laptop/mobile/Safari/Firefox, VFR, HEVC, HDR/color management, 4K and large sustained projects are unverified. Relinking checks metadata, not content hashes. Records are editable current state, not immutable audit history; recipe provenance is manual. Older app versions may discard new decision fields on re-export. Browser storage may be evicted; keep originals/full ZIPs. One editing tab per origin. No measured creator-time advantage or market validation, and no remote CI/push/Pages verification.

## Previous implementation receipt (historical)

Validated locally on Windows on **2026-11-03**, using Node.js 24.18.0 and Playwright Chromium 156.0.8078.4. Remote GitHub Actions and Pages have not been run by this local validation.

| Check                  | Result                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test`         | 26 unit tests passed                                                                                                             |
| `npm run build`        | Strict TypeScript check and Vite production build passed                                                                         |
| `npm run test:e2e`     | 8 browser workflow tests passed, 16.3 seconds                                                                                    |
| `npm run format:check` | All matched files passed                                                                                                         |
| Production subpath     | Static `dist/` loaded beneath a URL subpath; all nine demo sources reached readyState 4 without video or console errors          |
| Responsive layout      | Desktop 1440×1000 and mobile 390×844 checked; mobile page has no horizontal overflow; compact 1280×720 view inspected separately |
| Comparison media       | FFprobe decoded VP9, 1280×876, 141 frames, 6.015099 seconds, 1,368,651 bytes; no container/decoder warnings                      |

Browser acceptance flows:

1. Nine-way playback, drift below 160 ms in the sampled paused frame, one-frame nominal stepping, verdicts, blind metadata hiding and reload persistence.
2. Import video/reference/prompt/cost, export a complete ZIP, replace the workspace, restore the ZIP, reload and play its source.
3. Export Markdown and a real comparison video; reimport and decode the exported video.
4. Pagination limits mounted video players; filtering and both UI languages work; mobile layout fits the viewport.
5. Invalid ZIP and undecodable video report errors while preserving the existing project.
6. Start offsets immediately update paused source time; markers remain source-relative; moving/removing a take persists.
7. Canceling comparison recording releases recording resources and restores review players without a download or page error.
8. A metadata-only ZIP restores records with a missing source; relinking restores video playback without losing the prompt.

The demo sources are 640×360 H.264, 24 fps, six seconds long. These checks do **not** certify nine concurrent 4K decoders, every container/codec, Safari/Firefox, or mobile browser encoding. The capture's 141 decoded frames versus a nominal 144 illustrates the documented real-time capture limitation; final mastering should use the original files in an editor.

The reproducible checks live in `tests/`. Local detailed browser traces/downloads are in the ignored `test-results/` directory and the HTML report is in `playwright-report/`. The documentation screenshot is `docs/screenshot.png`.
