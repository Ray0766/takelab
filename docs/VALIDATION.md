# v0.1.0 validation receipt

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
