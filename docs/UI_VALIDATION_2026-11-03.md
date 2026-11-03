# UI revision validation — 2026-11-03

Scope: the lighter workspace, collapsible record panel, actual source previews, English/Chinese layouts and the pause/readout correction discovered during regression. Design reasoning and reference-access limitations: [reference analysis](UI_REDESIGN_2026-11-03.md).

## Visual evidence

- [Previous desktop](evidence/static-host-after.png) and [revised desktop](screenshot.png), both 1440 × 1000. The sample clips are original procedural artwork, not model benchmark outputs.
- [Empty workspace](evidence/ui-20261103/empty.png): no inactive filter/playback chrome; import and demo entry.
- [Nine-way comparison](evidence/ui-20261103/comparison.png) and [expanded comparison](evidence/ui-20261103/expanded.png): source time 3 seconds, details folded without remounting the players.
- [Two candidates and decision evidence](evidence/ui-20261103/decision-desktop.png): rejected candidate's observation supports the chosen take and links to its record.
- [1280 × 720 window](evidence/ui-20261103/compact.png): preview area scrolls, with at least 120 px video height in the tested layout. The lower row need not fit simultaneously.
- [Chinese 390 px layout](evidence/ui-20261103/decision-mobile-zh.png), [720 px zoom-equivalent layout](evidence/ui-20261103/decision-zoom-equivalent.png): no document-level horizontal overflow; keyboard evidence selection and reduced-motion mode exercised. This is a viewport-based zoom equivalent, not an OS magnifier test.

The screenshots were opened and inspected. The actual localhost page was also inspected in the in-app browser. Two-candidate previews retain their original aspect ratio; nine-way source images are contained rather than cropped. Original video brightness is unchanged by verdict.

## Executed checks

| Command / flow                                                                                 | Result                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                                                                | 29 unit checks and production build passed.                                                                                                                                                                           |
| `npx playwright test --output=.local/ui-redesign-final`                                        | 13 browser flows passed in 43.4 s, including import, blind selection, evidence linkage, portable ZIP restore, matching/mismatched relinks, comparison recording, cancellation, audio, offsets and mixed-FPS behavior. |
| `npx playwright test tests/e2e/transport.spec.ts --repeat-each=3 --output=.local/ui-pause-fix` | 6 checks passed in 7.4 s: three pause/marker trials plus three no-Range static-source seek trials.                                                                                                                    |
| `npm run test:sync`                                                                            | All 3 strict quality-gate trials passed in 48.6 s. Thresholds unchanged.                                                                                                                                              |
| `npx playwright test tests/e2e/interface.spec.ts --output=.local/ui-empty-final`               | Passed after the final empty-state cleanup. Captures refreshed from this run.                                                                                                                                         |
| `npm run build`, `npm run format:check`, `git diff --check`                                    | Final production/format/whitespace checks passed.                                                                                                                                                                     |

The panel test retains a handle to an actual video element, closes details, changes the selected take, reopens the marker editor and verifies that the same player is still connected. Closing returns focus to Details; Add marker opens and focuses the note. The test also records and revisits a 3-second observation. No fake success states or synthetic UI clocks are used.

## Failure retained and fixed

The first full UI run passed 11 of 12 flows. The between-update pause regression found source nominal frame **10** while the readout still showed **9**. See [failure screenshot](evidence/ui-20261103/pause-before-fix.png) and [after-fix screenshot](evidence/ui-20261103/pause-after-fix.png). The original trace remains locally under `.local/ui-redesign-tests/transport-pausing-between--cc8e4--source-and-marker-together/trace.zip`.

The playback UI publishes periodically, so stopping between publications could retain an older display. Pause now snapshots the leader's actual clock, stops/aligns players and publishes that position; the non-playing effect also publishes the final time. The existing real-button regression then passed all three repetitions. This is a state-consistency correction, not a claim of frame-exact decoding.

## Synchronization follow-up

Same declared fixtures and protocol as [the earlier validation](VALIDATION.md): 1920 × 1080 H.264, 24 fps / 8 s and 30 fps / 5 s, 0.5 s offset, audio, end hold and loop. Same Windows host (Core Ultra 9 285K, approximately 63 GiB RAM; RTX 5090 present), headless Chromium **156.0.8078.4**. Actual hardware-decoder use is not established.

| Trial | 1× presented p95 | 2× presented p95 | Paused seek settled |
| ----- | ---------------: | ---------------: | ------------------: |
| 1     |          58.3 ms |          41.7 ms |               38 ms |
| 2     |          41.7 ms |          58.3 ms |              146 ms |
| 3     |          58.3 ms |          58.3 ms |               44 ms |

Targets are ≤80 ms at 1× and ≤84 ms at 2×; all three trials also passed 0.5×, loop and maximum-spread checks. [Summary JSON](evidence/ui-20261103/sync-summary.json) and [all raw trials](evidence/ui-20261103/sync-trials.zip) retain the measurements. Presented timestamps are a frame-callback proxy, not an external capture. Earlier target misses remain in the historical receipts; these runs do not establish a universal guarantee or ordinary-laptop performance.

## Actual exported output

[Portable project](evidence/ui-20261103/decision-with-media.takelab.zip), [production record](evidence/ui-20261103/record.md), [project JSON](evidence/ui-20261103/project.json), [comparison video](evidence/ui-20261103/decision-comparison.webm) and [decoded frame at 3 seconds](evidence/ui-20261103/export-frame.png).

The exported record was read back: `orbit-07.mp4` is the winner; the reason cites `orbit-04.mp4`'s light flicker at source **3.000 s**; stable take/marker IDs link that observation to the source and generation record. Browser tests restored the portable ZIP and compared embedded source bytes to the originals. The exported video was re-imported by the test; FFmpeg decoded the complete file without errors, and its extracted frame was visually inspected.

FFprobe: **VP9, 1280 × 444, 144 frames, 6.020399 s, 617078 bytes**, no audio. SHA-256: `7a46d02ba66bfe8dc0b066375726ea12e9fcc2141753302cb26644f19d09a3d9`.

## Remaining limits

- No timed comparison or creator study has proved that the redesign improves selection speed, judgment or preference. It is a design iteration ready for Ray's review.
- Light surroundings are not calibrated grading conditions. Dark viewing-room comfort has not been evaluated; no theme system was added.
- Tested in Chromium on this host. Ordinary laptops, mobile browsers, nine simultaneous 1080p/4K videos, VFR and other codecs are not newly certified.
- Keyboard, narrow layout and reduced-motion checks are scoped checks, not a complete WCAG 2.2 conformance audit.
- No remote push, public deployment, model integration or cloud storage was performed.
