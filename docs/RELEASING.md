# Releasing TakeLab

This repository builds a static app. Publishing source, creating a GitHub Release, and deploying GitHub Pages are separate actions.

## Verify a release candidate

1. Use a clean checkout with Node.js 22.12+ and run `npm ci`.
2. Run `npm run format:check`, `npm run check`, and `npm run test:e2e` after installing the matching Playwright Chromium browser.
3. Test a representative real clip from your own workflow locally: import, sync at the target resolution, marker, backup, restore, export and play the result. The automated suite uses small synthetic clips; it does not certify nine concurrent 4K decoders on every GPU/browser.
   For the declared 1080p synchronization target, install FFmpeg and run `npm run test:sync` on the intended machine. This uses three trials and fails on any p95 target miss; keep failing receipts rather than rerunning until green. It does not certify other hardware or frame-locked playback.
4. Build with `npm run build` and serve `dist/` over HTTP. Check a repository subpath when using Pages.
5. Check the source tree for secrets, private prompts/recordings, personal filesystem paths and accidental `node_modules`, test-output or build artifacts. Original demo MP4s and the UI screenshot are intentional tracked assets.
6. Update the version, changelog, compatibility notes and screenshots when behavior changes.

## GitHub setup

- Confirm the repository description, MIT license, issue templates and visibility.
- Enable private vulnerability reporting if you want the private route linked in `SECURITY.md` to work.
- Let the CI workflow finish on the target commit. Do not describe an unrun remote CI workflow as passed.
- Tag a tested release and attach a ZIP of the static `dist/` output if desired. Include instructions to serve it over HTTP.

## Optional GitHub Pages

1. In repository Settings → Pages, select **GitHub Actions** as the build source.
2. Run **Deploy GitHub Pages** manually in Actions against the tested branch.
3. Verify the Pages deployment URL, bundled demo, import and export. Vite's relative asset base supports `/takelab/`.

The workflow is `workflow_dispatch` only. It does not deploy automatically on source pushes and does not change repository visibility. Deploying a new origin does not migrate existing browser data; use a project ZIP to move a workspace.
