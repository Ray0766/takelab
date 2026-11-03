# Security and privacy

TakeLab runs without a backend. Videos, reference images, prompts and review records are stored in the browser's IndexedDB for the current origin. There is no application telemetry, remote font, API credential, or media-upload endpoint. A host can still log requests for the static application and bundled demo files.

Project archives are untrusted input. The reader validates schema version, IDs, finite numeric bounds, shot relationships, verdicts, reference types, and the permitted demo filenames. ZIP extraction has a 512 MB total expanded-size limit, a file-count limit, and whitelisted entry paths. Prompts and annotations render as text, not HTML.

Local storage is not encrypted by TakeLab. Anyone with access to the browser profile or an exported ZIP may be able to read the data. Browser/site-data deletion and storage eviction can remove it. Keep original files and backups. Use a trusted host; third-party scripts served on the same origin could access its local storage.

## Report a vulnerability

Use **Security → Report a vulnerability** on [Ray0766/takelab](https://github.com/Ray0766/takelab/security/advisories/new) when private vulnerability reporting is enabled. If the option is unavailable, open a minimal issue asking for a private reporting channel; do not post an exploit, private recordings, credentials or client prompts publicly.

Only the current development version is maintained. Please include affected version/commit, a synthetic reproducer, impact and suggested mitigation when available.
