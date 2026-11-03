# Larger comparison area · 2026-11-03

Ray's follow-up: too much empty space and footage too small. Keep the contact-sheet identity and the tested playback/storage architecture; change how the workspace spends its available space.

## Change and tradeoff

The height-derived maximum grid width centered a small group inside a much wider canvas. Reducing only the outer padding would not remove that limit. Instead, the grid now fills the workspace width. Native `object-fit: contain` still preserves each source's aspect ratio; empty letterbox regions are not counted as larger footage.

- The desktop app bar is 50 px high and shot directory 36 px. Shot title, details and comparison tools share one row when there is room, and wrap when records or a narrow window require it.
- Preview gutters are 12 px at desktop edges and 8 px between candidates. The playback controls and timeline share a compact dock row on wider screens.
- Nine-up rows have a 220 px minimum, including their captions. A short window scrolls the comparison area instead of reducing source pictures to strips. This means nine simultaneous players are not necessarily all visible at once in a short window.
- A single row of candidates begins directly below the tools. It does not acquire a large top margin merely because the window is tall. All candidates retain equal sizing and unchanged pixels.
- Revisit evidence / selected-take navigation scrolls the target video into view as well as selecting and seeking it. The short-window test verifies that the actual source image is within the visible scroller.

No dependency, decoder, project schema, generation API or font change. The previous [reference analysis](UI_CONTACT_SHEET_2026-11-03.md) still informs the visual identity; its height-based grid sizing is superseded by this iteration. The underlying [synchronization limitations](DECISIONS.md) remain.

## Measured before and after

Baseline: commit `0ba60b8`. Same original Orbit sample, source position 3 seconds, browser Chromium 156.0.8078.4, CSS-pixel viewports shown below. Measure the first video rectangle and its intrinsic dimensions; rendered source scale is `min(elementWidth / videoWidth, elementHeight / videoHeight)`. This excludes the black bars from the reported picture size. Figures are rounded only in this table; [before](evidence/density-20261103/before.json) and [after](evidence/density-20261103/after.json) retain the measurements.

| Window / layout                      | Before, actual picture | After, actual picture | Picture area ratio |
| ------------------------------------ | ---------------------: | --------------------: | -----------------: |
| 1440 × 1000, nine-up, records closed |           269 × 151 px |          383 × 215 px |              2.03× |
| 1440 × 1000, four-up, records closed |           417 × 235 px |          581 × 327 px |              1.94× |
| 1440 × 900, nine-up, records closed  |           227 × 127 px |          331 × 186 px |              2.13× |
| 1280 × 720, nine-up, records open    |           227 × 127 px |          300 × 169 px |              1.75× |

At 1440 × 1000, the comparison area begins at y=134 instead of y=222.39. The dock is 82 px high instead of 130 px. At 1280 × 720 with records open, the tools wrap and the comparison begins at y=172. No measured case had document-width overflow. These are layout measurements for this fixture, not claims about task speed, decoder performance or arbitrary source aspect ratios.

## Real-flow verification

- Full browser regression: **13 passed in 44.1 seconds** (`.local/density-flows`). This includes simultaneous playback, paused source/readout alignment, mixed-FPS synchronization, audio, blind review, pagination, cancel, missing files and export/restore.
- Final interface + decision regression: **2 passed in 11.3 seconds** (`.local/density-verified`). Added actual-picture minimum-size checks, retained caption/row non-overlap checks, and checked cross-page selection at a short viewport. Chinese 390 px and 720 × 500 with reduced motion remain covered.
- [Nine-up](evidence/density-20261103/overview-zh.png), [four-up](evidence/density-20261103/four-up-zh.png), [short window with records](evidence/density-20261103/1280x720-9-record.png), [decision view](evidence/density-20261103/decision-desktop.png), [Chinese narrow view](evidence/density-20261103/decision-mobile-zh.png) were opened and inspected.
- [Portable ZIP](evidence/density-20261103/decision-with-media.takelab.zip), [record](evidence/density-20261103/record.md) and [project](evidence/density-20261103/project.json) retain winner `orbit-07.mp4`, rejected-source observation `orbit-04.mp4` at **3.000 seconds**, prompts and stable IDs. The generated 1280 × 444 VP9 comparison (6.004 seconds, 600,957 bytes) decoded completely in FFmpeg without errors; the generated video remains in the local test output.
- Production build, formatting and Git whitespace checks passed before delivery.

Source aspect ratios can still leave letterboxing; two landscape candidates cannot fill an arbitrarily tall window without cropping or changing their arrangement. Short-window scrolling is intentional. This iteration does not add a user study, new browser-engine certification, frame lock or a full accessibility audit.
