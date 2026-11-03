# Changelog

## Unreleased — traceable decisions and playback reliability

- Give footage the full workspace width, combine desktop title/filter controls, and compact the playback dock. Preserve larger images with scrolling in short windows; evidence/selection shortcuts scroll the corresponding source into view.

- Rebuild the interface as a contact sheet: horizontal shot directory, unboxed footage with letter captions, cobalt identity and locally bundled OFL display typography. Records start closed; the selected-take shortcut opens the decision and reveals its source at the current review moment.
- Preserve player instances while details are hidden; reopen and focus the marker composer from playback controls. Keep previews legible in short windows.
- Freeze the actual media clock and publish the final time on pause, fixing a readout that could lag by one nominal frame between UI updates.

- Make bundled demo seeking work on static hosts without HTTP byte-range support by reusing Blob playback and cleanup.
- Add a strict three-trial 1080p synchronization gate, per-player timing receipts and a pause/marker-position regression.

- Bind each winner to a written reason and explicit timestamp evidence from any candidate in its shot; retain stable source/marker IDs in reports and backups.
- Revisit filtered-out evidence, open the winner's generation record, and show incomplete decisions. Clear stale links when winners or sources change.
- Reject mismatched relink files instead of attaching old observations to different footage.
- Follow the actual media clock to avoid repeated decoder seeks during 2× startup; pause immediately and ignore expected interrupted-play errors.
- Preserve rejected footage brightness and use full-width equal panes for two candidates.
- Add mixed-FPS 1080p measurements, portable decision examples, official technical/design references and explicit verification limits.

## 0.1.0 — initial implementation

- Local multi-video import, filename-based shot grouping and source relinking.
- Bounded 1/4/9-player comparison with shared playback, seeking, nominal frame stepping, offsets and loop/speed controls.
- Blind review, shortlist, rejection and one winner per shot.
- Source-relative markers and editable generation records with references.
- Browser-local persistence, portable ZIP backup/restore, Markdown reports and real comparison video export.
- Original procedural demo clips, English/Chinese UI, responsive layouts and keyboard shortcuts.
- Unit/browser tests, CI, manual Pages deployment workflow and contributor documentation.

Limitations: browser-dependent codec support, approximate frame seeking, real-time silent comparison capture, one active project and one editing tab per origin. No generation APIs, automatic scoring or cloud sync.
