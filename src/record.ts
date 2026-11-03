import type { Take } from "./model";
import { reviewDuration, timecode } from "./model";
import { sourceFor } from "./media";
import { fixWebmDuration } from "@fix-webm-duration/fix";
import { streamingWebmSegment } from "./webm";

export function recordingType() {
  if (
    typeof MediaRecorder === "undefined" ||
    !HTMLCanvasElement.prototype.captureStream
  )
    return "";
  return (
    [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ].find((t) => MediaRecorder.isTypeSupported(t)) || ""
  );
}
export async function recordComparison(
  takes: Take[],
  labels: string[],
  fps: number,
  signal: AbortSignal,
  onProgress: (value: number) => void,
): Promise<{ blob: Blob; extension: string }> {
  const type = recordingType();
  if (!type)
    throw new Error(
      "Comparison recording is unavailable in this browser. Try desktop Chrome or Edge.",
    );
  if (!takes.length || takes.length > 9)
    throw new Error("Select between one and nine takes.");
  const length = reviewDuration(takes);
  if (length > 120)
    throw new Error("Comparison export is limited to 120 seconds per page.");
  const videos: HTMLVideoElement[] = [];
  const releases: (() => void)[] = [];
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let frame = 0;
  const aborted = () => {
    if (signal.aborted) throw new DOMException("Export canceled", "AbortError");
  };
  try {
    for (const t of takes) {
      aborted();
      const source = await sourceFor(t);
      if (!source) throw new Error(`Missing source: ${t.name}`);
      releases.push(source.release);
      aborted();
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      videos.push(video);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => finish(new Error("Video load timed out.")),
          15000,
        );
        const cancel = () =>
          finish(new DOMException("Export canceled", "AbortError"));
        const finish = (error?: Error) => {
          clearTimeout(timer);
          signal.removeEventListener("abort", cancel);
          video.onloadeddata = video.onerror = null;
          error ? reject(error) : resolve();
        };
        signal.addEventListener("abort", cancel, { once: true });
        video.onloadeddata = () => finish();
        video.onerror = () =>
          finish(new Error("Cannot decode this source video."));
        video.src = source.url;
      });
      if (t.offset > 0)
        await new Promise<void>((resolve, reject) => {
          const finish = (error?: Error) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", cancel);
            video.onseeked = null;
            error ? reject(error) : resolve();
          };
          const cancel = () =>
            finish(new DOMException("Export canceled", "AbortError"));
          const timer = setTimeout(
            () => finish(new Error("Video seek timed out.")),
            10000,
          );
          signal.addEventListener("abort", cancel, { once: true });
          video.onseeked = () => finish();
          video.currentTime = t.offset;
        });
    }
    aborted();
    const columns = takes.length === 1 ? 1 : takes.length <= 4 ? 2 : 3;
    const rows = Math.ceil(takes.length / columns);
    const cellW = 1280 / columns;
    const cellH = (cellW * 9) / 16 + 36;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = Math.ceil(rows * cellH + 48);
    const ctx = canvas.getContext("2d")!;
    const draw = (elapsed: number) => {
      ctx.fillStyle = "#15181c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      videos.forEach((v, i) => {
        const x = (i % columns) * cellW;
        const y = Math.floor(i / columns) * cellH;
        const scale = Math.min(
          (cellW - 8) / v.videoWidth,
          (cellH - 42) / v.videoHeight,
        );
        const w = v.videoWidth * scale,
          h = v.videoHeight * scale;
        ctx.drawImage(v, x + (cellW - w) / 2, y + (cellH - 36 - h) / 2, w, h);
        ctx.fillStyle = "#e3e6eb";
        ctx.font = "15px sans-serif";
        ctx.fillText(
          labels[i].slice(0, 52),
          x + 12,
          y + cellH - 12,
          cellW - 24,
        );
      });
      ctx.fillStyle = "#99a9bd";
      ctx.font = "16px sans-serif";
      ctx.fillText(
        `TakeLab   /   ${timecode(elapsed, fps)}   /   ${fps} fps review`,
        16,
        canvas.height - 16,
      );
    };
    draw(0);
    stream = canvas.captureStream(Math.min(fps, 30));
    recorder = new MediaRecorder(stream, {
      mimeType: type,
      videoBitsPerSecond: 6_000_000,
    });
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        error ? reject(error) : resolve();
      };
      const cancel = () =>
        finish(new DOMException("Export canceled", "AbortError"));
      const timer = setTimeout(
        () => finish(new Error("Playback did not start. Try fewer takes.")),
        10000,
      );
      signal.addEventListener("abort", cancel, { once: true });
      Promise.all(videos.map((v) => v.play())).then(() => finish(), finish);
    });
    aborted();
    const chunks: Blob[] = [];
    let failRecording: (error: Error) => void = () => {};
    const result = new Promise<Blob>((resolve, reject) => {
      failRecording = reject;
      const cancel = () => {
        if (recorder?.state !== "inactive") recorder?.stop();
        reject(new DOMException("Export canceled", "AbortError"));
      };
      signal.addEventListener("abort", cancel, { once: true });
      recorder!.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder!.onerror = () => {
        signal.removeEventListener("abort", cancel);
        reject(new Error("Video encoding failed. Try fewer takes."));
      };
      recorder!.onstop = () => {
        signal.removeEventListener("abort", cancel);
        resolve(new Blob(chunks, { type }));
      };
    });
    recorder.start(250);
    const start = performance.now();
    const tick = () => {
      if (signal.aborted) return;
      try {
        const elapsed = (performance.now() - start) / 1000;
        videos.forEach((video, index) => {
          if (video.error)
            throw new Error(
              "A source failed during recording. Relink it and try again.",
            );
          const expected = Math.min(
            elapsed + takes[index].offset,
            takes[index].duration - 0.001,
          );
          if (!video.seeking && Math.abs(video.currentTime - expected) > 0.15)
            video.currentTime = expected;
        });
        draw(Math.min(elapsed, length));
        onProgress(Math.min(elapsed / length, 1));
        if (elapsed >= length) recorder?.stop();
        else frame = requestAnimationFrame(tick);
      } catch (e) {
        failRecording(e instanceof Error ? e : new Error(String(e)));
      }
    };
    frame = requestAnimationFrame(tick);
    const rawBlob = await result;
    const blob = type.startsWith("video/webm")
      ? await streamingWebmSegment(
          await fixWebmDuration(rawBlob, performance.now() - start, {
            logger: false,
          }),
        )
      : rawBlob;
    return { blob, extension: type.startsWith("video/mp4") ? "mp4" : "webm" };
  } finally {
    cancelAnimationFrame(frame);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    videos.forEach((v) => {
      v.pause();
      v.removeAttribute("src");
      v.load();
    });
    releases.forEach((release) => release());
  }
}
