// Original deterministic test patterns; requires FFmpeg on PATH. No downloads.
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync(".local/sync-fixtures", { recursive: true });
for (const [fps, seconds, tone] of [
  [24, 8, 440],
  [30, 5, 660],
]) {
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc2=size=1920x1080:rate=${fps}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${tone}:sample_rate=48000`,
      "-t",
      String(seconds),
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-g",
      String(fps),
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-movflags",
      "+faststart",
      `.local/sync-fixtures/sync-${fps}.mp4`,
    ],
    { stdio: "inherit" },
  );
}
