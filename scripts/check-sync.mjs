// Optional release gate: real 1080p fixtures, three runs, original p95 targets.
import { spawnSync } from "node:child_process";

for (const args of [
  ["scripts/generate-sync-fixtures.mjs"],
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/e2e/sync.spec.ts",
    "--repeat-each=3",
    "--output=.local/sync-gate",
  ],
]) {
  const result = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, TAKELAB_SYNC_GATE: "strict" },
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status || 1);
}
