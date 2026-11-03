# Release preparation follow-up · 2026-11-03

Starting point: `1d8e601`, clean local branch. Scope: investigate remaining synchronization uncertainty and verify first use from a clean dependency installation. No new UI, model API, decoder stack, push or deployment.

## Strict synchronization gate

`npm run test:sync` generates the two original 1080p fixtures and runs the existing protocol **three times**. Any p95 above **80 ms** (or **84 ms at 2×**) fails the command. Ordinary browser tests still enforce regression bounds and now annotate strict target misses. This separates functional regression checks from the declared quality target instead of presenting either as the other.

Per-player media clocks, frame timestamps, callback times, expected-display times, composition submission times, processing durations and frame counts are retained. The [MDN frame callback documentation](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) distinguishes these clocks and explicitly describes best-effort scheduling. A stale callback alone is insufficient evidence for changing the playback rate or seeking the video.

Three initial diagnostic trials and three strict-gate trials were predeclared and retained, with no playback-controller edits between them. The strict trials took 51.1 seconds in total:

| Trial | 1× presented p95 | 0.5× p95 | 2× p95  | After-loop p95 | Presented seek settled |
| ----- | ---------------- | -------- | ------- | -------------- | ---------------------- |
| 1     | 50.0 ms          | 33.3 ms  | 50.0 ms | 33.3 ms        | 154 ms                 |
| 2     | 41.7 ms          | 33.3 ms  | 50.0 ms | 33.3 ms        | 164 ms                 |
| 3     | 25.0 ms          | 33.3 ms  | 41.7 ms | 33.3 ms        | 161 ms                 |

All three strict trials passed on this host. This **does not erase the earlier 83.3 ms miss** or certify frame lock/other hardware. Initial diagnostic callback ages reached 104.3 ms even while clock p95 was under 0.24 ms. No additional decoder tuning was justified by these observations. A real-video regression also exercised pause between UI refreshes, source/readout consistency, adding a marker, stepping and revisiting that marker; the original playback code passed three trials.

Receipts: [all six runs summarized](evidence/sync-followup-summary.json), [all raw samples and frame events](evidence/sync-followup-20261103.zip). These trials precede the bundled-demo loading fix below; their imported-1080p source path is unchanged by that fix.

## Clean install uncovered a static-host bug

Copied the 82 tracked/unignored project files into an independent directory with **no node_modules**, then ran `npm ci --offline` using the existing npm cache. It installed 106 packages. The isolated tree passed 29 unit tests, strict TypeScript and Vite production build. This is a clean dependency-directory check, not a new Windows installation or validation of minimum Node 22.12; this host runs Node 24.18.0. npm emitted an esbuild install-script approval warning, but installation and build completed; no global npm permission settings were changed.

Serving that `dist/` using Python's ordinary static HTTP server exposed a failure: after requesting 1.041667 s, a bundled demo video remained at **0 s**. Imported Blob sources and exports worked. The host returned full HTTP 200 video responses without byte-range support. [Before screenshot](evidence/static-host-before.png).

Fix in `src/media.ts`: fetch each small bundled demo into a Blob, then use the same object-URL playback path as imported videos. The existing release lifecycle revokes each URL; fetch has a 15-second timeout and failed responses remain errors. No transcoding, new dependencies or server requirements. Cost: transient Blob storage for the small demo clips; imported source handling is unchanged.

Applied this source fix to the independently installed tree, rebuilt, then repeated the same production checks on the same static server:

1. Nine-way playback, seeking/stepping, verdicts, blind mode and persistence — passed.
2. Import video/reference/notes, export full ZIP, restore and play — passed.
3. Export a real comparison video and reimport it — passed.

**3 passed in 12.5 seconds.** A separate regression intercepts demo requests with full-file HTTP 200 responses and confirms all nine sources seek to 3 s and then advance 1/24 s. [After screenshot](evidence/static-host-after.png). The final local suite results are recorded in VALIDATION.md. No styling or visual design was changed.

The production comparison export also decoded fully with FFprobe: **VP9, 1280×876, 142 frames, 6.021300 s, 1,452,525 bytes**, with no decoder/container errors. SHA-256: `D6E86F0B6E1352AD9DB2A83AD4951C7A04C5CF5225D5FB4812353A4EB784F087`. The final workspace check passed **29 unit tests and 12 browser tests (44.9 s)**, plus build and formatting. This capture remains real-time and is not frame-exact mastering.

## Reproduce

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:e2e
npm run test:sync # Optional strict host gate; requires FFmpeg on PATH
```

For the production reproduction, build a clean source copy and run `python -m http.server 4174 --bind 127.0.0.1 --directory dist` from that copy. Visit the address, load the bundled demo, seek and step. Python is only the test host, not an application dependency. Use the real deploy target for final publication verification.

Remaining boundaries from VALIDATION.md still apply: no typical-laptop or other-browser certification, no frame-exact mastering, no authenticated generation provenance, no content-hash relinking, no timed user study, and no remote CI or GitHub Pages verification.
