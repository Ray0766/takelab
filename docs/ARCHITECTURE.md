# Architecture

TakeLab is a client-only React + TypeScript application compiled by Vite. All runtime dependencies are bundled. There is no app server, model API, authentication flow, remote media service or telemetry.

## Modules

| Module                     | Responsibility                                                                   |
| -------------------------- | -------------------------------------------------------------------------------- |
| `src/App.tsx`              | Workbench orchestration, user actions, bilingual UI, serialized autosave         |
| `src/model.ts`             | Domain types, project validation, verdict/shot invariants, timecode and grouping |
| `src/storage.ts`           | IndexedDB transactions for records, media, atomic restore and removal            |
| `src/media.ts`             | Metadata probing, local source URLs, downloads, omitted-duration fallback        |
| `src/useTransport.ts`      | Shared review clock, bounded players, drift correction and frame steps           |
| `src/archive.ts`           | Whitelisted ZIP import, project export and escaped Markdown report               |
| `src/record.ts`            | Cancelable canvas + MediaRecorder comparison capture                             |
| `src/webm.ts`              | Preserve streaming Segment semantics after duration repair                       |
| `src/components/`          | Take card, reference preview and native modal dialog                             |
| `scripts/generate_demo.py` | Reproducible original demo video generation                                      |

## Persistence

Database `takelab`, version 1:

- `project`: the active `Project`, under key `active`.
- `media`: video and reference-image blobs, keyed by their opaque IDs.

Source files are stored before being added to the visible record. Record writes are queued in order. Replacement and source removal commit metadata and blobs together in a transaction. Operations that could replace state disable editing until they finish. Initial read failures do not create a blank project over the existing data.

Only one editing tab is supported. There is no multi-tab conflict resolution or migration beyond schema version 1. Persistent storage permission is not requested automatically. Browser eviction and quota limits are surfaced as limitations, not hidden behind a promise of durable backup.

## Review playback

A `requestAnimationFrame` loop follows the longest available player's actual media clock. The previous independent wall clock could advance during audio startup and repeatedly seek decoders at 2×. Registered players have a duration and start offset. Source time is `min(review time + offset, source duration)`. Drift greater than 100 ms triggers a correction. A decoder seeking/buffering pauses other players; backgrounding pauses playback. Shorter sources hold their end frame. Pause acts immediately and expected AbortErrors from interrupted play requests do not cancel a later playback session.

The selected review FPS defines keyboard step duration and display timecode; no frame-index parsing or transcoding is performed. This trades professional frame precision for a lightweight, dependency-free first-use experience. Only 1/4/9 visible players are mounted; export temporarily releases them and creates its own bounded player set. Large/unsupported media can still exhaust browser decoder resources.

## Project archive v1

An optional `Shot.decision` binds one winner ID to a reason and `{ takeId, markerId }` evidence references. Evidence may belong to rejected candidates in the same shot. The parser rejects dangling, duplicate and cross-shot references. Mutations clear a replaced winner's rationale and remove invalid evidence references. These are editable current records, not an immutable audit history. Older schema-1 projects remain readable; older app versions can discard decision fields on re-export.

Reports include stable project/shot/take/marker IDs and links from decision evidence to each source's generation record. Non-blind comparison videos show take IDs that match the report; blind recordings remain anonymous. Relinking checks name/size/duration/dimensions and rejects a mismatch rather than transferring old evidence to a different take. This is not a content hash.

```text
example.takelab.zip
  project.json          # schemaVersion: 1
  record.md             # portable human-readable production report
  media/<take-id>        # optional original video blobs
  refs/<reference-id>   # reference blobs
```

Names, MIME types, dimensions and source fingerprints live in `project.json`. IDs are whitelisted and unique; entry paths never become filesystem paths. Imported object fields are reconstructed explicitly. Only bundled `orbit-01.mp4` … `orbit-09.mp4` demo references are accepted; arbitrary remote media URLs are rejected. Markers refer to original source time, not review time.

Exports use asynchronous fflate ZIP creation with uncompressed media. Import is bounded synchronous extraction: at most 512 MB expanded data, 10,000 entries and 10 MB for the project record. The importer reads the archive into memory, so peak memory is greater than the raw payload size. The limit is a guardrail, not a memory guarantee. A streaming archive format is a possible future improvement for larger production projects.

## Comparison capture

Independent muted video elements feed a 1280-wide canvas. The recorder selects a supported MIME type at runtime, prefers WebM, and limits capture rate to 30 fps and duration to 120 seconds. Every frame includes anonymous or original labels and a review timecode. The recording is real time; it is not a deterministic offline render or audio mix. Backgrounding cancels it to avoid hidden-tab throttling. Abort, media failures and encoding failures release tracks, elements and object URLs.

WebM recordings get duration metadata via `@fix-webm-duration/fix`. Streaming size markers are preserved for the Segment and first Cluster so later Clusters remain siblings, allowing strict readers such as FFmpeg to decode the whole result cleanly.

## Technical references

- [Vite runtime requirements and build guide](https://vite.dev/guide/)
- [MediaRecorder format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [Canvas captureStream](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/captureStream)
- [WebM duration repair library](https://github.com/yusitnikov/fix-webm-duration)

See the tests for acceptance behavior rather than assuming these browser APIs promise frame-exact timing.
