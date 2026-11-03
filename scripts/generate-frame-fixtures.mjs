// Original synthetic pixel codes, independent of the decoder's timestamp index.
// FFmpeg / FFprobe are fixture-generation tools; neither ships in the web app.
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(".local/frame-fixtures");
await fs.mkdir(root, { recursive: true });
const width = 640,
  height = 360,
  count = 60;
const raw = Buffer.alloc(width * height * 3 * count);
for (let n = 0; n < count; n++) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value =
        y < 80 ? ((n >> Math.floor(x / 80)) & 1) * 255 : (n * 3 + y) % 256;
      const at = ((n * height + y) * width + x) * 3;
      raw.fill(value, at, at + 3);
    }
  }
}
const run = (bin, args) =>
  execFileSync(bin, args, { maxBuffer: 20 * 1024 * 1024 });
const truth = {};
for (const name of ["cfr", "vfr"]) {
  const file = path.join(root, `${name}.mp4`);
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "rawvideo",
      "-pixel_format",
      "rgb24",
      "-video_size",
      `${width}x${height}`,
      "-framerate",
      "30",
      "-i",
      "pipe:0",
      ...(name === "vfr"
        ? [
            "-vf",
            "select='lt(n,30)+gte(n,30)*not(mod(n,3))'",
            "-fps_mode",
            "vfr",
          ]
        : []),
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-g",
      "60",
      "-bf",
      "3",
      "-x264-params",
      "scenecut=0",
      "-movflags",
      "+faststart",
      file,
    ],
    { input: raw },
  );
  truth[name] = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_frames",
      "-show_entries",
      "frame=best_effort_timestamp_time,pict_type",
      "-of",
      "json",
      file,
    ]),
  ).frames;
}
run("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  path.join(root, "cfr.mp4"),
  "-c:v",
  "libvpx-vp9",
  "-crf",
  "28",
  "-b:v",
  "0",
  path.join(root, "vp9.webm"),
]);
run("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  path.join(root, "cfr.mp4"),
  "-c:v",
  "libx264",
  "-r",
  "60",
  "-g",
  "120",
  "-bf",
  "3",
  path.join(root, "60fps.mp4"),
]);
run("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-display_rotation:v:0",
  "90",
  "-i",
  path.join(root, "cfr.mp4"),
  "-c",
  "copy",
  path.join(root, "rotated.mp4"),
]);
run("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-i",
  path.join(root, "cfr.mp4"),
  "-c",
  "copy",
  "-output_ts_offset",
  "2",
  path.join(root, "nonzero.mp4"),
]);
await fs.writeFile(
  path.join(root, "truth.json"),
  JSON.stringify(truth, null, 2) + "\n",
);
const rotation = JSON.parse(
  run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream_side_data=rotation",
    "-of",
    "json",
    path.join(root, "rotated.mp4"),
  ]),
).streams[0].side_data_list?.[0]?.rotation;
if (rotation !== 90)
  throw new Error("Rotated fixture is missing its 90-degree display matrix");
console.log(
  `Created CFR 30/60, VFR 30→10, VP9, rotated and nonzero-start fixtures in ${root}`,
);
