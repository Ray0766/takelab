// Isolated research probe; does not install dependencies or touch application data.
// Prepare .local/technology-probe/package with the pinned npm tarball in the report.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const root = path.resolve(".local/technology-probe");
await fs.mkdir(root, { recursive: true });
const width = 640,
  height = 360,
  count = 60;
const raw = Buffer.alloc(width * height * 3 * count);
// Eight binary patches encode the original frame number, independent of PTS.
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
const rawPath = path.join(root, "frames.rgb");
await fs.writeFile(rawPath, raw);
const truth = {};
for (const name of ["cfr", "vfr"]) {
  const file = path.join(root, `${name}.mp4`);
  run("ffmpeg", [
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
    rawPath,
    ...(name === "vfr"
      ? ["-vf", "select='lt(n,30)+gte(n,30)*not(mod(n,3))'", "-fps_mode", "vfr"]
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
  ]);
  const probe = JSON.parse(
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
  );
  truth[name] = probe.frames.map((f) => ({
    pts: Number(f.best_effort_timestamp_time),
    originalFrame: Math.round(Number(f.best_effort_timestamp_time) * 30),
    type: f.pict_type,
  }));
}

const times = [
  0.01, 1.555, 0.032, 1.099, 0.034, 1.101, 0.998, 1.001, 1.032, 1.065, 0.5,
  1.899, 0.967, 0.965, 1.201, 1.199, 0.101, 0.099, 1.501, 1.499,
];
const bundle = path.join(root, "package/dist/bundles/mediabunny.mjs");
const worker = `import { Input, BlobSource, MP4, VideoSampleSink } from '/mediabunny.mjs';
onmessage = async ({data:{name,times}}) => {
  let input;
  try {
    input = new Input({source:new BlobSource(await (await fetch('/'+name+'.mp4')).blob()),formats:[MP4]});
    const track = await input.getPrimaryVideoTrack();
    const config = await track.getDecoderConfig();
    const supported = await VideoDecoder.isConfigSupported(config);
    const sink = new VideoSampleSink(track);
    const canvas = new OffscreenCanvas(640,360);
    const ctx = canvas.getContext('2d',{willReadFrequently:true});
    const samples=[];
    for(const t of times){
      const start=performance.now();
      const sample=await sink.getSample(t);
      if(!sample) throw new Error('Missing sample at '+t);
      try {
        sample.draw(ctx,0,0);
        let code=0;
        for(let bit=0;bit<8;bit++) if(ctx.getImageData(bit*80+40,40,1,1).data[0]>128) code|=1<<bit;
        samples.push({requested:t,pts:sample.timestamp,duration:sample.duration,code,elapsedMs:performance.now()-start});
      } finally {sample.close();}
    }
    const sequential=[];
    for await (const sample of sink.samples()) {sequential.push(sample.timestamp);sample.close();}
    postMessage({name,codec:config.codec,supported:supported.supported,samples,sequential});
  } catch(error){postMessage({error:String(error),stack:error.stack});}
  finally {input?.dispose();}
};`;
const routes = new Map([
  [
    "/",
    {
      body: "<!doctype html><title>TakeLab isolated frame probe</title>",
      type: "text/html",
    },
  ],
  ["/worker.mjs", { body: worker, type: "text/javascript" }],
  [
    "/mediabunny.mjs",
    { body: await fs.readFile(bundle), type: "text/javascript" },
  ],
  ...(await Promise.all(
    ["cfr", "vfr"].map(async (name) => [
      `/${name}.mp4`,
      {
        body: await fs.readFile(path.join(root, `${name}.mp4`)),
        type: "video/mp4",
      },
    ]),
  )),
]);
const server = http.createServer((req, res) => {
  const route = routes.get(req.url);
  if (!route) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": route.type });
  res.end(route.body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const capabilities = await page.evaluate(async () => ({
    videoDecoder: typeof VideoDecoder !== "undefined",
    offscreenCanvas: typeof OffscreenCanvas !== "undefined",
    webgpu: !!navigator.gpu,
    opfs: !!navigator.storage?.getDirectory,
    mediaCapabilities: await navigator.mediaCapabilities
      .decodingInfo({
        type: "file",
        video: {
          contentType: 'video/mp4; codecs="avc1.640028"',
          width: 1920,
          height: 1080,
          bitrate: 8000000,
          framerate: 30,
        },
      })
      .then(({ supported, smooth, powerEfficient }) => ({
        supported,
        smooth,
        powerEfficient,
      })),
  }));
  const results = [];
  for (const name of ["cfr", "vfr"]) {
    const decoded = await page.evaluate(
      ({ name, times }) =>
        new Promise((resolve, reject) => {
          const worker = new Worker("/worker.mjs", { type: "module" });
          const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error("Worker timeout"));
          }, 30000);
          worker.onmessage = ({ data }) => {
            clearTimeout(timer);
            worker.terminate();
            data.error ? reject(new Error(data.error)) : resolve(data);
          };
          worker.onerror = (e) => {
            clearTimeout(timer);
            worker.terminate();
            reject(new Error(e.message));
          };
          worker.postMessage({ name, times });
        }),
      { name, times },
    );
    const native = await page.evaluate(
      async ({ name, times }) => {
        const url = URL.createObjectURL(
          await (await fetch("/" + name + ".mp4")).blob(),
        );
        const v = document.createElement("video");
        v.muted = true;
        v.src = url;
        document.body.append(v);
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        try {
          await new Promise((resolve, reject) => {
            v.onloadeddata = resolve;
            v.onerror = reject;
          });
          const rows = [];
          for (const t of times) {
            const start = performance.now();
            let handle;
            const callback = new Promise((resolve) => {
              handle = v.requestVideoFrameCallback((_, m) =>
                resolve(m.mediaTime),
              );
            });
            const seek = new Promise((resolve, reject) => {
              v.onseeked = resolve;
              v.onerror = reject;
            });
            v.currentTime = t;
            await seek;
            let timer;
            const presented = await Promise.race([
              callback,
              new Promise((resolve) => {
                timer = setTimeout(() => resolve(null), 300);
              }),
            ]);
            clearTimeout(timer);
            v.cancelVideoFrameCallback(handle);
            ctx.drawImage(v, 0, 0);
            let code = 0;
            for (let bit = 0; bit < 8; bit++)
              if (ctx.getImageData(bit * 80 + 40, 40, 1, 1).data[0] > 128)
                code |= 1 << bit;
            rows.push({
              requested: t,
              currentTime: v.currentTime,
              presented,
              code,
              elapsedMs: performance.now() - start,
            });
          }
          return rows;
        } finally {
          v.remove();
          v.removeAttribute("src");
          v.load();
          URL.revokeObjectURL(url);
        }
      },
      { name, times },
    );
    const expected = (t) =>
      truth[name].filter((f) => f.pts <= t + 0.000001).at(-1);
    const samples = decoded.samples.map((row) => ({
      ...row,
      expected: expected(row.requested),
      matches:
        Math.abs(row.pts - expected(row.requested).pts) < 0.000002 &&
        row.code === expected(row.requested).originalFrame,
    }));
    const nativeRows = native.map((row) => ({
      ...row,
      expected: expected(row.requested),
      matches: row.code === expected(row.requested).originalFrame,
    }));
    const summary = (rows) => ({
      matched: rows.filter((r) => r.matches).length,
      total: rows.length,
      medianMs: rows.map((r) => r.elapsedMs).sort((a, b) => a - b)[
        Math.floor(rows.length / 2)
      ],
      p95Ms: rows.map((r) => r.elapsedMs).sort((a, b) => a - b)[
        Math.ceil(rows.length * 0.95) - 1
      ],
    });
    results.push({
      name,
      codec: decoded.codec,
      supported: decoded.supported,
      truth: truth[name],
      decoded: {
        samples,
        summary: summary(samples),
        sequential: decoded.sequential,
        sequentialMatches:
          decoded.sequential.length === truth[name].length &&
          decoded.sequential.every(
            (t, i) => Math.abs(t - truth[name][i].pts) < 0.000002,
          ),
      },
      native: { samples: nativeRows, summary: summary(nativeRows) },
    });
  }
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, "package/package.json"), "utf8"),
  );
  const receipt = {
    date: new Date().toISOString(),
    browser: browser.version(),
    node: process.version,
    library: {
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      bundleBytes: (await fs.stat(bundle)).size,
      bundleSha256: createHash("sha256")
        .update(await fs.readFile(bundle))
        .digest("hex"),
    },
    capabilities,
    protocol:
      "Two original 640x360 H.264 clips. CFR 30fps and VFR 30->10fps, B-frames, 20 nonmonotonic queries each. Expected frame = last FFprobe PTS <= query. Binary pixels verify frame identity. One decoder, hot local Blob; native includes callback/compositor wait, worker ends at offscreen readback. Latencies are not equivalent playback measurements.",
    results,
  };
  await fs.writeFile(
    path.join(root, "receipt.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        library: receipt.library,
        capabilities,
        results: results.map((r) => ({
          name: r.name,
          decoded: r.decoded.summary,
          sequentialMatches: r.decoded.sequentialMatches,
          native: r.native.summary,
        })),
      },
      null,
      2,
    ),
  );
  if (
    results.some(
      (r) =>
        r.decoded.summary.matched !== times.length ||
        !r.decoded.sequentialMatches,
    )
  )
    process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
