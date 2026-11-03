import { expect, it } from "vitest";
import { streamingWebmSegment } from "../../src/webm";

it("keeps unknown-sized clusters in an unknown-sized segment without altering data", async () => {
  const input = new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x81, 0x00, 0x18, 0x53, 0x80, 0x67, 0x40, 0x03,
    0x11, 0x22, 0x33,
  ]);
  const output = new Uint8Array(
    await (
      await streamingWebmSegment(new Blob([input], { type: "video/webm" }))
    ).arrayBuffer(),
  );
  expect(output.slice(0, 10)).toEqual(input.slice(0, 10));
  expect(output.slice(10, 12)).toEqual(new Uint8Array([0x7f, 0xff]));
  expect(output.slice(12)).toEqual(input.slice(12));
});

it("leaves non-WebM input unchanged", async () => {
  const blob = new Blob(["not webm"]);
  expect(await streamingWebmSegment(blob)).toBe(blob);
});

it("restores the first streaming Cluster boundary as well as its Segment", async () => {
  const input = new Uint8Array([
    0x18, 0x53, 0x80, 0x67, 0x89, 0x1f, 0x43, 0xb6, 0x75, 0x84, 0x11, 0x22,
    0x33, 0x44,
  ]);
  const output = new Uint8Array(
    await (await streamingWebmSegment(new Blob([input]))).arrayBuffer(),
  );
  expect(output[4]).toBe(0xff);
  expect(output[9]).toBe(0xff);
  expect(output.slice(10)).toEqual(input.slice(10));
});
