export type Language = "en" | "zh";
export type Verdict = "unreviewed" | "shortlisted" | "rejected" | "winner";
export type MarkerKind = "issue" | "good" | "note";
export interface SourceMoment {
  ptsUs: number;
  trackId: number;
  sourceHash: string;
}
export interface FrameEvidence extends SourceMoment {
  id: string;
  frameIndex: number;
  width: number;
  height: number;
  pngHash: string;
  createdAt: string;
}
export interface ActionAnchor extends SourceMoment {
  label: string;
}
export interface Marker {
  id: string;
  time: number;
  kind: MarkerKind;
  text: string;
  frame?: FrameEvidence;
}
export interface Reference {
  id: string;
  name: string;
  type: string;
}
export interface Take {
  id: string;
  shotId: string;
  name: string;
  size: number;
  lastModified: number;
  type: string;
  duration: number;
  width: number;
  height: number;
  offset: number;
  verdict: Verdict;
  model: string;
  prompt: string;
  negativePrompt: string;
  seed: string;
  settings: string;
  cost: number | null;
  markers: Marker[];
  references: Reference[];
  demo?: string;
  sourceHash?: string;
  anchor?: ActionAnchor;
}
export interface Shot {
  id: string;
  name: string;
  decision?: Decision;
}
export interface EvidenceRef {
  takeId: string;
  markerId: string;
}
export interface Decision {
  takeId: string;
  reason: string;
  evidence: EvidenceRef[];
}
// A decision belongs to one winner. Never carry its rationale to another winner.
// Evidence can reference other candidates, but only inside the same shot.
export function reconcileDecisions(project: Project): Project {
  return {
    ...project,
    shots: project.shots.map((shot) => {
      const winner = project.takes.find(
        (t) => t.shotId === shot.id && t.verdict === "winner",
      );
      const { decision, ...base } = shot;
      if (!winner) return base;
      return {
        ...base,
        decision:
          decision?.takeId === winner.id
            ? {
                ...decision,
                evidence: decision.evidence.filter((ref) =>
                  project.takes.some(
                    (t) =>
                      t.shotId === shot.id &&
                      t.id === ref.takeId &&
                      t.markers.some((m) => m.id === ref.markerId),
                  ),
                ),
              }
            : { takeId: winner.id, reason: "", evidence: [] },
      };
    }),
  };
}
export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  fps: number;
  shots: Shot[];
  takes: Take[];
}
export const uid = () => crypto.randomUUID();
export const createProject = (name = "Untitled project"): Project => ({
  schemaVersion: 1,
  id: uid(),
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  fps: 24,
  shots: [{ id: uid(), name: "Shot 01" }],
  takes: [],
});
export function createTake(
  file: File,
  shotId: string,
  metadata: { duration: number; width: number; height: number },
): Take {
  return {
    id: uid(),
    shotId,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type || "video/mp4",
    ...metadata,
    offset: 0,
    verdict: "unreviewed",
    model: "",
    prompt: "",
    negativePrompt: "",
    seed: "",
    settings: "",
    cost: null,
    markers: [],
    references: [],
  };
}
export function setVerdict(
  project: Project,
  id: string,
  verdict: Verdict,
): Project {
  const target = project.takes.find((t) => t.id === id);
  return reconcileDecisions({
    ...project,
    takes: project.takes.map((t) =>
      t.id === id
        ? { ...t, verdict }
        : verdict === "winner" &&
            t.shotId === target?.shotId &&
            t.verdict === "winner"
          ? { ...t, verdict: "shortlisted" }
          : t,
    ),
  });
}
export function moveTake(
  project: Project,
  id: string,
  shotId: string,
): Project {
  return reconcileDecisions({
    ...project,
    takes: project.takes.map((t) =>
      t.id === id
        ? {
            ...t,
            shotId,
            verdict:
              t.verdict === "winner" &&
              project.takes.some(
                (x) => x.shotId === shotId && x.verdict === "winner",
              )
                ? "shortlisted"
                : t.verdict,
          }
        : t,
    ),
  });
}
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const reviewDuration = (takes: Take[]) =>
  Math.max(0, ...takes.map((t) => t.duration - t.offset));
export function timecode(time: number, fps = 24): string {
  const frame = Math.max(0, Math.round(time * fps));
  return `${String(Math.floor(frame / fps / 60)).padStart(2, "0")}:${String(Math.floor(frame / fps) % 60).padStart(2, "0")}:${String(frame % fps).padStart(2, "0")}`;
}
export function formatBytes(bytes: number) {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
export function inferShotName(filename: string) {
  const stem = filename.replace(/\.[^.]+$/, "");
  return (
    stem
      .replace(
        /(?:[_\- ](?:take|version|ver|v|t|seed)[_\- ]?\d+)(?:[_\- ].*)?$/i,
        "",
      )
      .trim() || stem
  );
}
export function blindOrder(takes: Take[], seed: number) {
  const hash = (id: string) => {
    let n = seed;
    for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return n >>> 0;
  };
  return [...takes].sort((a, b) => hash(a.id) - hash(b.id));
}

// Project files are untrusted. Rebuild a bounded, whitelisted object at this boundary.
export function parseProject(value: unknown): Project {
  const fail = (): never => {
    throw new Error(
      "Invalid or unsupported TakeLab project (schema version 1 required).",
    );
  };
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : fail();
  const str = (v: unknown, max = 20000): string =>
    typeof v === "string" && v.length <= max ? v : fail();
  const id = (v: unknown) => {
    const s = str(v, 100);
    return /^[\w-]+$/.test(s) ? s : fail();
  };
  const num = (v: unknown, max = 1e12) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max
      ? v
      : fail();
  const integer = (v: unknown, max = 1e12) => {
    const n = num(v, max);
    return Number.isSafeInteger(n) ? n : fail();
  };
  const hash = (v: unknown) => {
    const s = str(v, 64);
    return /^[a-f0-9]{64}$/.test(s) ? s : fail();
  };
  const moment = (
    v: Record<string, unknown>,
    duration: number,
  ): SourceMoment => ({
    ptsUs: integer(v.ptsUs, Math.ceil(duration * 1e6)),
    trackId: integer(v.trackId),
    sourceHash: hash(v.sourceHash),
  });
  const arr = (v: unknown, max: number): unknown[] =>
    Array.isArray(v) && v.length <= max ? v : fail();
  const p = obj(value);
  if (p.schemaVersion !== 1) fail();
  const ids = new Set<string>();
  const unique = (v: unknown) => {
    const s = id(v);
    if (ids.has(s)) fail();
    ids.add(s);
    return s;
  };
  const rawShots = arr(p.shots, 1000);
  const shots: Shot[] = rawShots.map((v) => {
    const s = obj(v);
    return { id: unique(s.id), name: str(s.name, 200) };
  });
  if (!shots.length) fail();
  const takes = arr(p.takes, 3000).map((v) => {
    const t = obj(v);
    const shotId = id(t.shotId);
    if (!shots.some((s) => s.id === shotId)) fail();
    const verdict = str(t.verdict) as Verdict;
    if (!["unreviewed", "shortlisted", "rejected", "winner"].includes(verdict))
      fail();
    const duration = num(t.duration, 86400);
    const offset = num(t.offset, duration);
    if (duration <= 0 || offset >= duration) fail();
    const take: Take = {
      id: unique(t.id),
      shotId,
      name: str(t.name, 500),
      size: num(t.size),
      lastModified: num(t.lastModified, 1e15),
      type: str(t.type, 100),
      duration,
      width: num(t.width, 32768),
      height: num(t.height, 32768),
      offset,
      verdict,
      model: str(t.model, 200),
      prompt: str(t.prompt),
      negativePrompt: str(t.negativePrompt),
      seed: str(t.seed, 500),
      settings: str(t.settings),
      cost: t.cost === null ? null : num(t.cost, 1e9),
      markers: arr(t.markers, 2000).map((v) => {
        const m = obj(v);
        const kind = str(m.kind) as MarkerKind;
        if (!["issue", "good", "note"].includes(kind)) fail();
        const marker: Marker = {
          id: unique(m.id),
          time: num(m.time, duration),
          kind,
          text: str(m.text, 2000),
        };
        if (m.frame !== undefined) {
          const f = obj(m.frame);
          marker.frame = {
            ...moment(f, duration),
            id: unique(f.id),
            frameIndex: integer(f.frameIndex, 59999),
            width: integer(f.width, 4096),
            height: integer(f.height, 4096),
            pngHash: hash(f.pngHash),
            createdAt: str(f.createdAt, 100),
          };
          if (
            !marker.frame.width ||
            !marker.frame.height ||
            marker.frame.width * marker.frame.height > 4096 * 2160 ||
            Math.abs(marker.time * 1e6 - marker.frame.ptsUs) > 1
          )
            fail();
        }
        return marker;
      }),
      references: arr(t.references, 30).map((v) => {
        const r = obj(v);
        const type = str(r.type, 100);
        if (
          !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(type)
        )
          fail();
        return { id: unique(r.id), name: str(r.name, 500), type };
      }),
    };
    if (
      !Number.isInteger(take.width) ||
      !Number.isInteger(take.height) ||
      take.width <= 0 ||
      take.height <= 0
    )
      fail();
    if (t.demo !== undefined) {
      const demo = str(t.demo, 100);
      if (!/^orbit-0[1-9]\.mp4$/.test(demo)) fail();
      take.demo = demo;
    }
    if (t.sourceHash !== undefined) take.sourceHash = hash(t.sourceHash);
    if (t.anchor !== undefined) {
      const a = obj(t.anchor);
      take.anchor = { ...moment(a, duration), label: str(a.label, 120) };
      if (
        !take.anchor.label.trim() ||
        take.anchor.sourceHash !== take.sourceHash ||
        Math.abs(take.offset * 1e6 - take.anchor.ptsUs) > 1
      )
        fail();
    }
    const frames = take.markers.flatMap((m) => (m.frame ? [m.frame] : []));
    if (
      frames.length > 50 ||
      frames.some((f) => f.sourceHash !== take.sourceHash)
    )
      fail();
    return take;
  });
  if (
    takes.reduce((n, t) => n + t.markers.filter((m) => m.frame).length, 0) > 500
  )
    fail();
  for (const shot of shots)
    if (
      takes.filter((t) => t.shotId === shot.id && t.verdict === "winner")
        .length > 1
    )
      fail();
  rawShots.forEach((raw, index) => {
    const d = obj(raw).decision;
    if (d === undefined) return; // Existing schema-1 archives remain readable.
    const value = obj(d);
    const takeId = id(value.takeId);
    const shot = shots[index];
    if (
      !takes.some(
        (t) =>
          t.id === takeId && t.shotId === shot.id && t.verdict === "winner",
      )
    )
      fail();
    const seen = new Set<string>();
    shot.decision = {
      takeId,
      reason: str(value.reason, 4000),
      evidence: arr(value.evidence, 2000).map((v) => {
        const ref = obj(v);
        const takeId = id(ref.takeId);
        const markerId = id(ref.markerId);
        const key = `${takeId}/${markerId}`;
        if (
          seen.has(key) ||
          !takes.some(
            (t) =>
              t.id === takeId &&
              t.shotId === shot.id &&
              t.markers.some((m) => m.id === markerId),
          )
        )
          fail();
        seen.add(key);
        return { takeId, markerId };
      }),
    };
  });
  const fps = num(p.fps, 60);
  if (![12, 24, 25, 30, 50, 60].includes(fps)) fail();
  return {
    schemaVersion: 1,
    id: id(p.id),
    name: str(p.name, 200),
    createdAt: str(p.createdAt, 100),
    updatedAt: str(p.updatedAt, 100),
    fps,
    shots,
    takes,
  };
}
