import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createDemo } from "../../src/demo";
import { parseProject, reconcileDecisions } from "../../src/model";
import { frameAt } from "../../src/frames/types";
import { hashBlob, takeMediaIds } from "../../src/evidence";
import { importArchive, reportMarkdown } from "../../src/archive";
import { zipSync, strToU8 } from "fflate";

function fixture() {
  const p = createDemo(),
    take = p.takes[0];
  take.sourceHash = "a".repeat(64);
  take.offset = 1.1;
  take.anchor = {
    ptsUs: 1100000,
    trackId: 1,
    sourceHash: take.sourceHash,
    label: "Reference action",
  };
  take.markers.push({
    id: "frame-marker",
    time: 1.1,
    kind: "issue",
    text: "Frame observation",
    frame: {
      id: "frame-image",
      ptsUs: 1100000,
      trackId: 1,
      sourceHash: take.sourceHash,
      frameIndex: 31,
      width: 640,
      height: 360,
      pngHash: "b".repeat(64),
      createdAt: "2026-11-03T00:00:00Z",
    },
  });
  return p;
}
describe("source-frame evidence integrity", () => {
  it("finds the covering frame on mixed-duration timelines, including boundaries and endpoint holds", () => {
    const pts = [0, 33333, 66667, 100000, 200000, 300000];
    expect(
      [-0.1, 0, 0.033332, 0.033333, 0.033334, 0.099, 0.15, 0.2, 5].map((t) =>
        frameAt(pts, t),
      ),
    ).toEqual([0, 0, 0, 1, 1, 2, 3, 4, 5]);
  });
  it("preserves frame and anchor provenance through parsing and includes image links in the record", () => {
    const p = fixture();
    expect(parseProject(p)).toEqual(p);
    expect(reportMarkdown(p)).toContain("evidence/frame-image.png");
    expect(reportMarkdown(p)).toContain("Source PTS: 1100000 µs");
    expect(reportMarkdown(p)).toContain("Action anchor: Reference action");
    expect(takeMediaIds(p.takes[0])).toContain("frame-image");
  });
  it.each([
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].markers.at(-1)!.time = 1.2;
    },
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].markers.at(-1)!.frame!.sourceHash = "c".repeat(64);
    },
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].markers.at(-1)!.frame!.id = "../elsewhere";
    },
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].markers.at(-1)!.frame!.width = 10000;
    },
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].markers.at(-1)!.frame!.ptsUs = 1100000.5;
    },
    (p: ReturnType<typeof fixture>) => {
      p.takes[0].anchor!.ptsUs = 1000000;
    },
    (p: ReturnType<typeof fixture>) => {
      delete p.takes[0].sourceHash;
    },
  ])("rejects broken source-time, identity or image bounds %#", (mutate) => {
    const p = fixture();
    mutate(p);
    expect(() => parseProject(p)).toThrow();
  });
  it("removes a deleted frame marker from the winner's decision", () => {
    const p = fixture();
    p.takes[0].verdict = "winner";
    p.shots[0].decision = {
      takeId: p.takes[0].id,
      reason: "Test",
      evidence: [{ takeId: p.takes[0].id, markerId: "frame-marker" }],
    };
    p.takes[0].markers = [];
    expect(reconcileDecisions(p).shots[0].decision!.evidence).toEqual([]);
  });
  it("hashes multiple chunks identically to native SHA-256", async () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 31).fill(73);
    expect(await hashBlob(new Blob([bytes]))).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    const abort = new AbortController();
    abort.abort();
    await expect(hashBlob(new Blob([bytes]), abort.signal)).rejects.toThrow();
  });
  it("rejects an archive with a missing evidence image before replacing workspace data", async () => {
    const bytes = zipSync({
      "project.json": strToU8(JSON.stringify(fixture())),
    });
    await expect(
      importArchive(
        new File([bytes], "missing-image.zip", { type: "application/zip" }),
      ),
    ).rejects.toThrow("Missing source-frame evidence");
  });
});
