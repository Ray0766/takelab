import { describe, expect, it } from "vitest";
import {
  blindOrder,
  createProject,
  inferShotName,
  moveTake,
  reconcileDecisions,
  parseProject,
  reviewDuration,
  setVerdict,
  timecode,
} from "../../src/model";
import { createDemo } from "../../src/demo";
import { reportMarkdown, importArchive } from "../../src/archive";
import { strToU8, zipSync } from "fflate";

describe("project integrity", () => {
  it("keeps one winner per shot and demotes a previous winner", () => {
    let p = createDemo();
    p = setVerdict(p, p.takes[0].id, "winner");
    p = setVerdict(p, p.takes[1].id, "winner");
    expect(p.takes[0].verdict).toBe("shortlisted");
    expect(p.takes.filter((t) => t.verdict === "winner")).toHaveLength(1);
  });
  it("preserves winner uniqueness when moving between shots", () => {
    let p = createDemo();
    p = setVerdict(p, p.takes[0].id, "winner");
    p = moveTake(p, p.takes[1].id, p.shots[1].id);
    p = setVerdict(p, p.takes[1].id, "winner");
    p = moveTake(p, p.takes[1].id, p.shots[0].id);
    expect(p.takes[1].verdict).toBe("shortlisted");
  });
  it("accepts a complete record and discards unknown properties", () => {
    const p = createDemo();
    expect(parseProject({ ...p, malicious: true })).toEqual(p);
    expect(parseProject(createProject()).takes).toHaveLength(0);
  });
  it.each([
    (p: ReturnType<typeof createDemo>) => {
      p.schemaVersion = 2 as 1;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].id = "../outside";
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].duration = Infinity;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].offset = 7;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].shotId = "missing";
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].demo = "https://example.com/track.mp4";
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].id = p.takes[1].id;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].verdict = p.takes[1].verdict = "winner";
    },
    (p: ReturnType<typeof createDemo>) => {
      p.fps = 0;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].duration = 0;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].offset = p.takes[0].duration;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].width = 0;
    },
    (p: ReturnType<typeof createDemo>) => {
      p.takes[0].markers.push({ id: "x", time: 10, text: "", kind: "issue" });
    },
  ])("rejects malformed project data %#", (mutate) => {
    const p = createDemo();
    mutate(p);
    expect(() => parseProject(p)).toThrow();
  });
});
describe("review calculations", () => {
  it("steps timecode on frame boundaries including a minute rollover", () => {
    expect(timecode(1 / 24, 24)).toBe("00:00:01");
    expect(timecode(59 + 23 / 24, 24)).toBe("00:59:23");
    expect(timecode(60, 24)).toBe("01:00:00");
  });
  it("uses the longest offset-adjusted source", () => {
    const p = createDemo();
    p.takes[0].duration = 10;
    p.takes[0].offset = 2;
    expect(reviewDuration(p.takes)).toBe(8);
  });
  it("groups explicit take suffixes without eating shot numbers", () => {
    expect(inferShotName("scene01_take_03.mp4")).toBe("scene01");
    expect(inferShotName("scene01_v02_kling.mp4")).toBe("scene01");
    expect(inferShotName("scene_01.mp4")).toBe("scene_01");
  });
  it("keeps a stable blind order through verdict changes", () => {
    const p = createDemo();
    const before = blindOrder(p.takes, 1234).map((t) => t.id);
    const after = blindOrder(
      setVerdict(p, p.takes[0].id, "rejected").takes,
      1234,
    ).map((t) => t.id);
    expect(before).toEqual(after);
  });
});
describe("portable exports", () => {
  it("round-trips cross-candidate evidence and preserves source times and IDs", async () => {
    let p = createDemo();
    p.takes[1].markers.push({
      id: "fault",
      time: 3.25,
      kind: "issue",
      text: "Ring breaks",
    });
    p.takes[1].offset = 0.5;
    p = setVerdict(p, p.takes[0].id, "winner");
    p.shots[0].decision!.reason = "Stable ring";
    p.shots[0].decision!.evidence = [
      { takeId: p.takes[1].id, markerId: "fault" },
    ];
    const restored = await importArchive(
      new File(
        [zipSync({ "project.json": strToU8(JSON.stringify(p)) })],
        "record.zip",
      ),
    );
    expect(restored.project).toEqual(p);
    const report = reportMarkdown(restored.project);
    expect(report).toContain("Reason: Stable ring");
    expect(report).toContain("source 3.250 s");
    expect(report).toContain("review 2.750 s");
    expect(report).toContain(`Evidence ID: ${p.takes[1].id}/fault`);
    expect(report).toContain(`(#take-${p.takes[1].id})`);
    expect(report).toContain(p.takes[1].prompt);
  });
  it("clears stale decisions and unlinks removed or moved evidence", () => {
    let p = createDemo();
    p.takes[1].markers.push({
      id: "fault",
      time: 3,
      kind: "issue",
      text: "Fault",
    });
    p = setVerdict(p, p.takes[0].id, "winner");
    p.shots[0].decision!.reason = "A reason for this winner only";
    p.shots[0].decision!.evidence = [
      { takeId: p.takes[1].id, markerId: "fault" },
    ];
    const moved = moveTake(p, p.takes[1].id, p.shots[1].id);
    expect(moved.shots[0].decision!.evidence).toEqual([]);
    const changed = setVerdict(p, p.takes[2].id, "winner");
    expect(changed.shots[0].decision!.reason).toBe("");
    p.takes[1].markers = [];
    expect(reconcileDecisions(p).shots[0].decision!.evidence).toEqual([]);
    expect(() => parseProject(p)).toThrow(); // Dangling imports are rejected.
    expect(
      setVerdict(p, p.takes[0].id, "unreviewed").shots[0].decision,
    ).toBeUndefined();
  });
  it("rejects evidence from another shot and duplicate references", () => {
    let p = createDemo();
    p.takes[1].markers.push({
      id: "fault",
      time: 3,
      kind: "issue",
      text: "Fault",
    });
    p = setVerdict(p, p.takes[0].id, "winner");
    const ref = { takeId: p.takes[1].id, markerId: "fault" };
    p.shots[0].decision!.evidence = [ref, ref];
    expect(() => parseProject(p)).toThrow();
    p.shots[0].decision!.evidence = [ref];
    p.takes[1].shotId = p.shots[1].id;
    expect(() => parseProject(p)).toThrow();
  });
  it("preserves prompts containing markdown code fences", () => {
    const p = createDemo();
    p.takes[0].prompt = "````\n<script>alert(1)</script>\n````";
    const report = reportMarkdown(p);
    expect(report).toContain(
      "`````\n````\n<script>alert(1)</script>\n````\n`````",
    );
    expect(report).toContain("source, before the review offset");
  });
  it("restores the record and whitelisted media only", async () => {
    const p = createDemo();
    const bytes = zipSync({
      "project.json": strToU8(JSON.stringify(p)),
      [`media/${p.takes[0].id}`]: new Uint8Array([1, 2, 3]),
      "../evil": new Uint8Array([4]),
    });
    const result = await importArchive(new File([bytes], "backup.zip"));
    expect(result.project).toEqual(p);
    expect(result.media.size).toBe(1);
  });
  it("rejects non-project archives", async () => {
    const bytes = zipSync({ "readme.txt": strToU8("hello") });
    await expect(
      importArchive(new File([bytes], "not-project.zip")),
    ).rejects.toThrow("project.json");
  });
});
