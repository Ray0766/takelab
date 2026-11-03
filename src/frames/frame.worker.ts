/// <reference lib="webworker" />
import {
  Input,
  BlobSource,
  MP4,
  MATROSKA,
  WEBM,
  EncodedPacketSink,
  VideoSampleSink,
} from "mediabunny";
import type { VideoSample } from "mediabunny";
import { hashBlob } from "../evidence";
import type { FrameCommand, FrameInfo } from "./types";

const scope = self as unknown as DedicatedWorkerGlobalScope;
let input: Input | undefined;
let sink: VideoSampleSink | undefined;
let info: FrameInfo | undefined;
let current: VideoSample | undefined;
let currentIndex = -1;
const canvas = new OffscreenCanvas(1, 1);
const ctx = canvas.getContext("2d")!;

async function open(blob: Blob, expectedHash?: string): Promise<FrameInfo> {
  if (typeof VideoDecoder === "undefined")
    throw new Error("UNSUPPORTED_BROWSER");
  if (blob.size > 2 * 1024 ** 3) throw new Error("SOURCE_TOO_LARGE");
  current?.close();
  current = undefined;
  input?.dispose();
  input = new Input({
    source: new BlobSource(blob),
    formats: [MP4, WEBM, MATROSKA],
  });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("NO_VIDEO");
  const config = await track.getDecoderConfig();
  if (!config || !(await VideoDecoder.isConfigSupported(config)).supported)
    throw new Error("UNSUPPORTED_CODEC");
  if (
    ["pq", "hlg", "smpte2084", "arib-std-b67"].includes(
      String(config.colorSpace?.transfer),
    )
  )
    throw new Error("HDR_UNSUPPORTED");
  const width = await track.getDisplayWidth(),
    height = await track.getDisplayHeight();
  if (width > 4096 || height > 4096 || width * height > 4096 * 2160)
    throw new Error("FRAME_TOO_LARGE");
  const packets = new EncodedPacketSink(track);
  const ptsUs: number[] = [];
  let count = 0;
  for await (const packet of packets.packets(undefined, undefined, {
    metadataOnly: true,
  })) {
    if (++count > 60000) throw new Error("TOO_MANY_FRAMES");
    if (packet.timestamp >= 0) ptsUs.push(Math.round(packet.timestamp * 1e6));
  }
  ptsUs.sort((a, b) => a - b);
  // Do not silently guess how an unusual container timeline maps to HTML video.
  if (
    !ptsUs.length ||
    ptsUs[0] > 2 ||
    ptsUs.some((p, i) => i > 0 && p === ptsUs[i - 1])
  )
    throw new Error("TIMELINE_UNSUPPORTED");
  const sourceHash = await hashBlob(blob);
  if (expectedHash && sourceHash !== expectedHash)
    throw new Error("SOURCE_MISMATCH");
  info = { ptsUs, trackId: track.id, sourceHash, width, height };
  sink = new VideoSampleSink(track);
  currentIndex = -1;
  return info;
}
async function read(index: number) {
  if (
    !info ||
    !sink ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= info.ptsUs.length
  )
    throw new Error("INVALID_FRAME");
  if (index !== currentIndex || !current) {
    current?.close();
    current = undefined;
    currentIndex = -1;
    // PTS is stored rounded to microseconds. Seek at the upper rounding edge
    // so 30 fps timestamps such as 1.033333333 do not select the prior frame.
    const sample = await sink.getSample((info.ptsUs[index] + 0.5) / 1e6);
    if (!sample) throw new Error("FRAME_UNAVAILABLE");
    if (Math.abs(sample.timestamp * 1e6 - info.ptsUs[index]) > 1) {
      sample.close();
      throw new Error("FRAME_MISMATCH");
    }
    if (
      ["pq", "hlg", "smpte2084", "arib-std-b67"].includes(
        String(sample.colorSpace.transfer),
      )
    ) {
      sample.close();
      throw new Error("HDR_UNSUPPORTED");
    }
    current = sample;
    currentIndex = index;
  }
  if (
    canvas.width !== current.displayWidth ||
    canvas.height !== current.displayHeight
  ) {
    canvas.width = current.displayWidth;
    canvas.height = current.displayHeight;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  current.draw(ctx, 0, 0);
  return {
    index,
    ptsUs: info.ptsUs[index],
    trackId: info.trackId,
    sourceHash: info.sourceHash,
    width: canvas.width,
    height: canvas.height,
  };
}
// Serialize decoder access; UI coalesces seeks and termination cancels the queue.
let queue = Promise.resolve();
scope.onmessage = ({ data }: MessageEvent<FrameCommand & { id: number }>) => {
  queue = queue.then(async () => {
    try {
      if (data.op === "open") {
        scope.postMessage({
          id: data.id,
          value: await open(data.blob, data.expectedHash),
        });
      } else {
        const meta = await read(data.index);
        if (data.op === "capture") {
          const blob = await canvas.convertToBlob({ type: "image/png" });
          if (blob.size > 32 * 1024 ** 2) throw new Error("IMAGE_TOO_LARGE");
          scope.postMessage({
            id: data.id,
            value: { ...meta, blob, pngHash: await hashBlob(blob) },
          });
        } else {
          const bitmap = canvas.transferToImageBitmap();
          scope.postMessage({ id: data.id, value: { ...meta, bitmap } }, [
            bitmap,
          ]);
        }
      }
    } catch (error) {
      scope.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
};
