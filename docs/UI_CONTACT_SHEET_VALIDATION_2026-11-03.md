# Contact-sheet validation · 2026-11-03

## Run and scope

Windows host Ray-5090; Node 24.18.0, Playwright 1.64.1, Chromium 156.0.8078.4. Same host as the preceding validation: Core Ultra 9 285K, approximately 63 GiB RAM, RTX 5090 present. GPU decoder selection was not measured. The screenshots use original synthetic demo media, not generated model benchmarks.

- `npm run test`: **29 passed**.
- `npx playwright test --output=.local/ui-contact-final`: **13 passed in 45.3 s**.
- After visual inspection exposed four-up row overlap, constrained the group width/card height and added a geometry assertion. Re-ran the interface and complete decision flows: **2 passed in 11.3 s**. After the cell-height safeguard, the final interface run passed again in **2.4 s**, including font loading, cross-page winner navigation and a long Chinese/English shot name at 390 px. The interface screenshots come from this final run.
- Production build and formatting checked before delivery. No deployment or push.

The first regression pass found two tests still assuming the record panel was always open. They now open **Details** explicitly; the production restore behavior was unchanged. Unit testing initially encountered sandbox temporary-file rename restrictions; the same tests passed in the host test environment. These are distinguished from the actual four-up layout defect found by looking at screenshots.

## User-facing evidence

All paths below are in [the evidence directory](evidence/contact-sheet-20261103/).

Chinese desktop screenshots were also captured through the real language toggle and sample-project controls: [empty project](evidence/contact-sheet-20261103/empty-zh.png), [nine-up](evidence/contact-sheet-20261103/overview-zh.png), [four-up](evidence/contact-sheet-20261103/four-up-zh.png).

| Evidence                                                                                                                                                                                      | What was checked                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Empty project](evidence/contact-sheet-20261103/empty.png)                                                                                                                                    | Actual import button, runnable sample project, original sample imagery and new display typography.                                                                                    |
| [Selected nine-up overview](evidence/contact-sheet-20261103/selected-overview.png)                                                                                                            | Horizontal shots, unboxed footage, letter captions, shared time and selected-take decision entry.                                                                                     |
| [Four-up](evidence/contact-sheet-20261103/four-up.png)                                                                                                                                        | Every image and caption stays in its own row; no image/caption overlap.                                                                                                               |
| [1280 × 720](evidence/contact-sheet-20261103/compact.png)                                                                                                                                     | Scrollable grid retains at least 120 px preview height; no document-width overflow.                                                                                                   |
| [Decision](evidence/contact-sheet-20261103/decision-desktop.png)                                                                                                                              | Winner is `orbit-07.mp4`; linked evidence belongs to rejected `orbit-04.mp4` at source **3.000 seconds**. Revisit reveals the source and seeks to it.                                 |
| [Chinese, 390 px](evidence/contact-sheet-20261103/decision-mobile-zh.png), [720 × 500](evidence/contact-sheet-20261103/decision-zoom-equivalent.png)                                          | No document-width overflow, Chinese labels, keyboard traversal and reduced-motion mode. This is not a full WCAG audit.                                                                |
| [Portable ZIP](evidence/contact-sheet-20261103/decision-with-media.takelab.zip), [record](evidence/contact-sheet-20261103/record.md), [project](evidence/contact-sheet-20261103/project.json) | Stable winner/source/marker IDs, exact timestamp, reason and both prompts survive export and restore. Metadata-only restore explains missing sources and rejects a mismatched relink. |
| [Comparison video](evidence/contact-sheet-20261103/decision-comparison.webm), [decoded frame](evidence/contact-sheet-20261103/export-frame.png)                                               | Actual VP9 output, 1280 × 444, approximately 6.02 seconds, silent. Opened the decoded frame, checked labels, and decoded the complete video with FFmpeg without errors.               |

Record panel close/reopen and the selected-take shortcut retain the existing player elements. The new shortcut restores the selected winner at the existing 3-second review moment. Selecting a caption while details are closed leaves them closed; adding a marker opens and focuses the note. Paging still limits active decoders to the selected 1/4/9 view. Blind mode hides model/filename/recipe content. Cancellation, audio selection, shorter-clip holding and project restoration remain covered.

## Synchronization receipt

[Raw measurement](evidence/contact-sheet-20261103/sync-measurement.json), same deterministic mixed 24/30 fps 1920 × 1080 fixtures and original thresholds as [DECISIONS](DECISIONS.md). This is one post-redesign regression trial, not a new repeated certification.

| Condition         | Presented timestamp spread p95 | Maximum |
| ----------------- | -----------------------------: | ------: |
| 1×, two sources   |                        25.0 ms | 41.7 ms |
| 0.5×, two sources |                        33.3 ms | 41.7 ms |
| 2×, two sources   |                        58.3 ms | 66.7 ms |
| Loop              |                        33.3 ms | 33.3 ms |

This trial met the predeclared p95 thresholds (80 ms at 1×, 84 ms at 2×). The historical 83.3 ms miss at 1× remains documented; this run does not erase it or establish frame lock. The native playback controller was not changed by this redesign. The pause/readout/source-marker regression also passed.

Seek settled in 141 ms by media clocks and 150 ms by presented-frame callbacks, within the original 750 ms target.

## Remaining limits

Visual acceptance is pending Ray's review. There is no timed creator study against an ordinary player/folder workflow, no ordinary-laptop performance certification, no new Safari/Firefox verification, and no calibrated color-viewing guarantee. Mobile layout checks do not certify mobile multi-decoder performance. Source-frame accuracy, VFR, nine 1080p streams, 4K, HEVC and full accessibility remain outside this evidence. The reference review includes public pages/screenshots, not paid signed-in product trials.
