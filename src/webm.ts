// Duration repair can wrap later Clusters in a finite first Cluster. Preserve
// streaming boundaries for both Segment and that first Cluster, without touching
// the encoded frames. Otherwise strict readers treat the next Cluster as a child.
export async function streamingWebmSegment(blob: Blob): Promise<Blob> {
  const header = new Uint8Array(await blob.slice(0, 4096).arrayBuffer());
  const width = (byte: number, max: number) => {
    for (let n = 1; n <= max; n++) if (byte & (1 << (8 - n))) return n;
    return 0;
  };
  let offset = 0;
  let changed = false;
  while (offset < header.length) {
    const idLength = width(header[offset], 4);
    if (!idLength) break;
    let id = 0;
    for (let n = 0; n < idLength; n++) id = id * 256 + header[offset + n];
    const sizeOffset = offset + idLength;
    const sizeLength = width(header[sizeOffset], 8);
    if (!sizeLength || sizeOffset + sizeLength > header.length) break;
    if (id === 0x18538067 || id === 0x1f43b675) {
      const unknown = new Uint8Array(sizeLength).fill(255);
      unknown[0] = (1 << (9 - sizeLength)) - 1;
      header.set(unknown, sizeOffset);
      changed = true;
      if (id === 0x1f43b675) break;
      offset = sizeOffset + sizeLength;
      continue;
    }
    let size = header[sizeOffset] & ((1 << (8 - sizeLength)) - 1);
    for (let n = 1; n < sizeLength; n++)
      size = size * 256 + header[sizeOffset + n];
    offset = sizeOffset + sizeLength + size;
  }
  return changed
    ? new Blob([header, blob.slice(header.length)], { type: blob.type })
    : blob;
}
