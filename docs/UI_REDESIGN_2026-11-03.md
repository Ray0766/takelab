# Interface revision — 2026-11-03

> Historical iteration: Ray rejected this layout. The current [contact-sheet revision](UI_CONTACT_SHEET_2026-11-03.md) supersedes its visual rules and composition. The reference observations below remain part of the research record.

Ray's feedback: the overall interface felt like an AI-generated template. This revision changes the workspace hierarchy, not just its accent color. The task remains choosing between local video takes and retaining the reason, source-time observations and generation record.

## References actually reviewed

All links checked on 2026-11-03. Visual observations below are our interpretation, not a claim of endorsement or equivalent design quality.

| Reference and evidence                                                                                                                                                                            | Specific observation                                                                                                     | TakeLab adaptation                                                                              | Boundary                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Paper](https://paper.design/), public homepage and embedded editor demonstration viewed in the browser                                                                                           | Quiet navigation and property controls surround the actual work; typography distinguishes the canvas content from tools. | Neutral surfaces, simple shot rows, a restrained detail panel, content-derived demo thumbnails. | Homepage/editor demonstration only; no signed-in editing session. Do not copy its paper texture, typography assets, marketing sections or agent features.                                       |
| [Play, Apple Design Awards 2025](https://www.apple.com/au/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/), official full product image viewed              | The central artifact carries the visual interest, while layers and properties stay at the edges.                         | Let videos provide the imagery; collapse the record panel when comparing.                       | Apple is the organizer; Play is the **Innovation app winner**, not an Interaction winner. The award is for the product, not every visual choice. No attempt to reproduce its prototyping tools. |
| [Feather: Draw in 3D, same official awards page](https://www.apple.com/au/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/), official iPad screenshot viewed | Large artwork with compact peripheral tools.                                                                             | Remove the statistics block and repeated workspace/status headings that compete with footage.   | **Visuals and Graphics app winner**, 2025. Touch/3D gestures and floating controls over artwork do not transfer directly to a desktop video review tool.                                        |
| [ChatGPT](https://chatgpt.com/), browser homepage shell viewed                                                                                                                                    | A subdued navigation rail and a dominant task entry.                                                                     | Empty state has one primary import action and a secondary demo.                                 | Some content did not finish loading. No conversations were opened; private sidebar content was not saved to the repository. No claim to have reviewed all product states.                       |
| [Claude](https://claude.com/), public homepage viewed                                                                                                                                             | Distinct type hierarchy, substantial whitespace, black primary action and an actual work scene.                          | Clear primary/secondary action contrast and plain task copy.                                    | Do not transplant its serif brand typography, warm palette, login composition or photography into a review workspace.                                                                           |
| [Gemini](https://gemini.google/about/), public homepage viewed, plus its overview page                                                                                                            | One dominant action; examples provide the visual emphasis. The overview keeps long text in a readable column.            | Use our own sample footage; keep notes in a bounded-width panel.                                | Promotional motion, large hero type and colorful brand effects would distract from judging footage. Marketing-site review, not a signed-in product evaluation.                                  |

No reference code, logos, fonts, photos or screenshots are redistributed. The only new images are three 256-pixel-wide frames extracted from TakeLab's original procedural demo clips. No new dependency or external runtime request.

## Paper: comparison as an interaction problem

Reviewed the author-hosted abstract and bibliographic entry for Michael Gleicher's [_Considerations for Visualizing Comparisons_](https://graphics.cs.wisc.edu/Papers/2018/Gle18/) (IEEE TVCG 24(1), January 2018; InfoVis 2017; DOI 10.1109/TVCG.2017.2744199), the text of the author's [conference slides](https://graphics.cs.wisc.edu/Talks/Gleicher/2017/VisComp-given.pdf), and his [September 2025 retrospective](https://pages.graphics.cs.wisc.edu/VisSnacks/papers/comparison/). The publisher's full article required a browser verification step; PDF screenshot retrieval timed out. This is not a full-text/figure review. The 2025 page also contains an explicitly AI-generated summary; our rationale uses the author's own preceding discussion.

This is established research, not a new 2026 result. The useful framework starts with the comparison task and its scale, then chooses a strategy and representation. Applied here: a creator identifies usable candidates among repeated takes; many complex moving objects compete for attention. Retain aligned, equally sized previews, use shortlist/pagination to reduce the set, and keep observations next to the decision. Do not overlay different takes or replace them with an invented aesthetic score. The framework supports a design rationale; it does not prove that this UI improves selection speed or artistic judgment. The author's retrospective also cautions against treating the taxonomy's categories too rigidly.

## Alternatives and chosen direction

1. Simplify the existing dark editing desk. Low visual migration cost and suitable for dim rooms, but it retains much of the dense panel/chip language Ray rejected.
2. Light tool surfaces with a neutral viewing area. Clear separation between controls and original footage, lighter navigation, readable records. Higher styling/QA cost and potentially too bright in a dark viewing room.

Choose direction 2 for this iteration. This supersedes the earlier graphite visual direction in DECISIONS.md. Playback scheduling, file formats, persistence, archive schema and generation-record fields remain the baseline. The only transport change is the pause/readout bug found during real regression testing.

```text
TakeLab   Project                                      Import   Export
Shots     Shot title                                  Details
          All / Shortlist     Filter / Blind / Layout   Notes & record
          Equal source previews                        Decision / Record / Markers
          Shared playback and source-linked timeline   Reason + evidence
```

The detail panel can be closed. Selecting another preview leaves it closed; the letter/inspect button or Add marker opens it. Closing returns keyboard focus to Details. Hidden details do not unmount players. When no take is selected, the empty panel is omitted.

## Visual rules

- Palette: white tools `#ffffff`, outer surface `#f5f5f3`, neutral desk `#e9e9e6`, ink `#252525`, secondary text `#686863`, keyboard/selection blue `#265dc6`. Green `#26704d` means selected/good; red `#a43d38` means rejected/issue. Verdicts also have text/icons.
- Type: native Segoe UI Variable / Segoe UI, with PingFang SC and Microsoft YaHei Chinese fallbacks. 22 px shot name, 16 px inspected take, 13 px editable content, 12 px tabs and preview labels. Small 10–11 px metadata is secondary. No remote font loading or decorative display face.
- Spacing: 4/8 px control rhythm, 14 px preview gaps, 20–22 px panel padding. Borders separate editable fields and selection states; ordinary navigation is a list, not a card collection.
- Motion: only short control-state transitions; no entrance or decorative animation. Respect reduced-motion preferences.
- Preview integrity: `object-fit: contain`, no recoloring, cropping, rejected-state dimming or different preview sizes by verdict. A short desktop window scrolls the preview area instead of shrinking footage into strips. Two-candidate layouts keep landscape previews centered in their shared viewing area.
- Copy: remove the story slogan, duplicate workspace breadcrumb, version badge, review progress decoration and project-statistics block. Keep cost in the generation record and exported reports. Use concrete import, marker, selection and export actions.

## Validation and limits

The design hypothesis is that less surrounding UI and a larger usable preview make daily comparison easier to scan. Before/after screenshots provide visual evidence; no user study or timed task comparison has established better taste, higher accuracy or faster work. Light surroundings can affect viewing comfort and perception; this is not a calibrated color-grading environment.

Validation receipts, screenshots and remaining limitations are recorded in [UI validation](UI_VALIDATION_2026-11-03.md). Existing ordinary-hardware, codec, variable-frame-rate and frame-lock limits still apply. Keyboard/responsive checks do not amount to a full WCAG audit.
