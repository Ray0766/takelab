# Contact-sheet interface · 2026-11-03

> The later [density revision](UI_DENSITY_2026-11-03.md) supersedes the spacing, control heights and height-derived maximum grid width below. The reference analysis and local typography remain applicable.

## Brief and choice

Ray rejected the previous light three-column workbench and explicitly chose a more expressive visual direction, with stronger typography and composition. This revision supersedes the layout and visual rules in [the previous design record](UI_REDESIGN_2026-11-03.md); that record remains the source of the reference review and its access limitations.

The task is still daily review of repeated video takes: inspect the same moment, select one, and retain the observation and generation record. The deliverable is a working local application, including empty, comparison, decision, narrow-window and export states. This is not a marketing-only redesign.

Two directions considered:

- **Poster-like entrance:** large typography and footage create a distinctive first impression. Useful for an empty project, but a full marketing composition would consume comparison space during actual work.
- **Photographic contact sheet:** horizontal shot index, equally sized sources, letter captions, and one shared transport. Chosen for the workspace because viewers need to scan and name candidates. The stronger entrance is limited to the empty state.

The genericness review rejected decorative counters, oversized metadata chips and a permanent three-column shell. The resulting composition removes the vertical shot sidebar and card shells. Records start closed; opening them does not recreate video elements. A selected-take shortcut reveals the winner and its decision at the current review moment, including when the source was filtered or on another page.

```text
TakeLab       Project                                     Import  Export
Shots   01 The approach   02 Surface detail   03 The departure
Shot title                              Selected G / decision   Details
All / Shortlist                              Filter / Blind / Layout
                   A      B      C                  [optional record]
                   D      E      F                   reason / evidence
                   G      H      I                   generation recipe
                Shared playback, time and source markers
```

## References translated into this product

Actual visual review of these pages and official screenshots is documented in the previous record, dated the same day. We reuse that review rather than claim a new signed-in product evaluation.

| Reference                                                                                                                                                    | Specific method                                                                                                                                           | TakeLab adaptation and boundary                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Paper](https://paper.design/)                                                                                                                               | Content occupies the canvas; chrome is quiet and subordinate.                                                                                             | Remove the permanent shot sidebar; open records only when needed. Keep native source rendering. Do not reproduce Paper's artwork, tool panels or brand.                                                                                                                     |
| [Play and Feather, Apple Design Awards 2025](https://www.apple.com/au/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/) | Their official screenshots put authored work in the center with controls around its edges. Play won **Innovation**; Feather won **Visuals and Graphics**. | Use a continuous footage area and a shared playback dock. These are reference signals, not evidence of TakeLab's quality or usability. Their spatial/3D interactions do not transfer to a synchronized comparison grid.                                                     |
| [ChatGPT](https://chatgpt.com/), [Claude](https://claude.com/), [Gemini](https://gemini.google/about/)                                                       | A clear primary action and a distinct separation of navigation from authored content.                                                                     | The empty state leads with importing footage; the sample is a real runnable project. Avoid reproducing chat composers, Claude's palette/type or Gemini's promotional animation. Previous review was limited to the available shell/public pages.                            |
| [Gleicher, Considerations for Visualizing Comparisons](https://graphics.cs.wisc.edu/Papers/2018/Gle18/)                                                      | Choose a comparison representation from the actual task and number of complex objects.                                                                    | Keep equal sources, shared time and 1/4/9 views. Identity letters connect footage to observations. This established 2018 paper supports the rationale; it does not establish a speed/accuracy gain for TakeLab. Full-text access limitations remain in the previous record. |

## Visual and interaction rules

- Palette: ink `#202430`, paper `#ffffff`, viewing surface `#f4f5f7`, cobalt `#304cdb`, secondary text `#656b79`, rules `#dce0e7`. Green/red remain verdict semantics, accompanied by text or icons.
- Display: **Bricolage Grotesque 48pt SemiBold**, 34 px brand, 32 px shot title, 26 px take letters, 24 px shared time, 46–84 px empty-state title. Its expressive shapes supply identity without borrowing a reference product's brand.
- Body: Segoe UI Variable / Segoe UI; PingFang SC / Microsoft YaHei Chinese fallback. Controls 12–14 px, secondary metadata 10–11 px. Font weights and short line lengths keep long records readable.
- Spacing: 32 px desktop edges, 20 px horizontal and 18 px vertical footage gaps; 16–24 px edges on smaller screens. The desktop contact sheet uses available height to preserve source proportion; short windows scroll rather than crop footage. Four-up cards are constrained to their grid cells to prevent row overlap.
- Footage retains `object-fit: contain`; rejection changes the caption/status, not the pixels. Large preview images in the empty state are explicitly synthetic sample artwork. Only the empty-state composition is tilted; actual comparison sources stay aligned.
- Motion is limited to short control-state feedback. Reduced-motion preference is respected. No entrance animation, automatic promotional playback or external tracking.
- Visible and accessible sample-button text now agree: **Open the sample project / 打开示例项目**. See [WCAG label-in-name rationale](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html). This is one scoped correction, not a conformance claim.

## Technology, cost and licensing

Keep React / TypeScript / Vite, native HTML video, IndexedDB and the existing archive format. No decoder, state-management or UI-component library migration. Package-lock remains unchanged. The practical benefit is a new composition without moving stored projects or changing the already-tested transport.

CSS container-relative height constrains the comparison group. [MDN's length reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/length#container_query_length_units), checked 2026-11-03, defines `cqh` relative to the query container. This avoids adding a resize observer and extra layout state. Width and cell-height constraints remain in place, and small screens use ordinary flowing layout. Tested in Chromium 156; other browser rendering engines are not newly certified.

One 46,712-byte locally hosted font replaces the system face only for display roles. It adds a local asset request, no remote service or running fee. Source is the [author repository](https://github.com/ateliertriay/bricolage/tree/84745e5b96261ae5f8c6c856e262fe78d1d6efdd), pinned commit `84745e5b96261ae5f8c6c856e262fe78d1d6efdd`, checked 2026-11-03. Unmodified font and SIL OFL 1.1 text ship together in `public/fonts/`. Body/CJK system fallbacks keep the application usable if the font fails to load. The three preview images now use the source's 640-pixel width instead of enlarging 256-pixel thumbnails; together they are 10,376 bytes. No external reference artwork is redistributed.

## Evidence and limits

See [validation receipts](UI_CONTACT_SHEET_VALIDATION_2026-11-03.md). The testable product distinction remains **winner → source-time evidence → generation record → portable project**, not a claim to be the first or best comparison player. It removes manual filename/time/recipe cross-referencing in the demonstrated task. Whether creators prefer this layout, work faster, or maintain better records remains an unvalidated hypothesis. Ray has not yet accepted this visual revision.
