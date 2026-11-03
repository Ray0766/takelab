import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FrameEvidence, Take } from "./model";

// Incremental hashing bounds memory even for large imported sources.
export async function hashBlob(blob: Blob, signal?: AbortSignal) {
  const hash = sha256.create();
  try {
    for (let at = 0; at < blob.size; at += 4 * 1024 * 1024) {
      signal?.throwIfAborted();
      hash.update(
        new Uint8Array(
          await blob.slice(at, at + 4 * 1024 * 1024).arrayBuffer(),
        ),
      );
    }
    signal?.throwIfAborted();
    return bytesToHex(hash.digest());
  } finally {
    hash.destroy();
  }
}

export const takeMediaIds = (take: Take) => [
  take.id,
  ...take.references.map((r) => r.id),
  ...take.markers.flatMap((m) => (m.frame ? [m.frame.id] : [])),
];

export async function validateFrameBlob(blob: Blob, frame: FrameEvidence) {
  if (blob.size > 32 * 1024 * 1024 || blob.size < 24)
    throw new Error("Invalid evidence image size.");
  const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const view = new DataView(header.buffer);
  if (
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => header[i] === v) ||
    view.getUint32(16) !== frame.width ||
    view.getUint32(20) !== frame.height ||
    (await hashBlob(blob)) !== frame.pngHash
  )
    throw new Error(
      "Evidence image does not match its saved fingerprint or dimensions.",
    );
  const decoded = await createImageBitmap(blob);
  try {
    if (decoded.width !== frame.width || decoded.height !== frame.height)
      throw new Error("Invalid evidence image dimensions.");
  } finally {
    decoded.close();
  }
}
