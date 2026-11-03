import type { SourceMoment } from "../model";

export interface FrameInfo {
  ptsUs: number[];
  trackId: number;
  sourceHash: string;
  width: number;
  height: number;
}
export interface DecodedFrame extends SourceMoment {
  index: number;
  width: number;
  height: number;
  bitmap: ImageBitmap;
}
export interface CapturedFrame extends Omit<DecodedFrame, "bitmap"> {
  blob: Blob;
  pngHash: string;
}
export type FrameCommand =
  | { op: "open"; blob: Blob; expectedHash?: string }
  | { op: "frame"; index: number }
  | { op: "capture"; index: number };

// Latest source sample at or before the review time, with explicit endpoint hold.
export function frameAt(ptsUs: number[], seconds: number) {
  const us = Math.round(seconds * 1e6);
  let low = 0,
    high = ptsUs.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (ptsUs[mid] <= us) low = mid;
    else high = mid - 1;
  }
  return low;
}
