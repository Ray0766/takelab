import { unzipSync, zip, strFromU8, strToU8 } from "fflate";
import { parseProject, timecode } from "./model";
import type { Project } from "./model";
import { readMedia } from "./storage";
import { demoUrl } from "./media";

const LIMIT = 512 * 1024 * 1024;
const escape = (s: string) =>
  s.replace(/[\\`*_{}\[\]<>#|]/g, "\\$&").replace(/[\r\n]+/g, " ");
const fence = (s: string) => {
  const marks = "`".repeat(
    Math.max(3, ...[...s.matchAll(/`+/g)].map((m) => m[0].length + 1)),
  );
  return `${marks}\n${s}\n${marks}`;
};
export function reportMarkdown(p: Project) {
  const lines = [
    `# ${escape(p.name)}`,
    "",
    `TakeLab production record · ${escape(p.updatedAt)}`,
    "",
    `Review timebase: ${p.fps} fps. Marker times refer to the original source, before the review offset. Costs are entered manually in USD.`,
    "",
  ];
  for (const shot of p.shots) {
    lines.push(`## ${escape(shot.name)}`, "");
    for (const [i, t] of p.takes
      .filter((t) => t.shotId === shot.id)
      .entries()) {
      lines.push(
        `### ${i + 1}. ${escape(t.name)} — ${t.verdict}`,
        "",
        `- Source: ${t.width} × ${t.height}, ${t.duration.toFixed(3)} s`,
        `- Review offset: ${t.offset.toFixed(3)} s`,
        `- Model: ${escape(t.model || "Not recorded")}`,
        `- Seed: ${escape(t.seed || "Not recorded")}`,
        `- Cost (USD): ${t.cost === null ? "Not recorded" : t.cost.toFixed(2)}`,
        "",
        "#### Prompt",
        "",
        fence(t.prompt || "Not recorded"),
        "",
        "#### Negative prompt",
        "",
        fence(t.negativePrompt || "Not recorded"),
        "",
        "#### Generation settings / notes",
        "",
        fence(t.settings || "Not recorded"),
        "",
        "#### Markers",
        "",
      );
      lines.push(
        ...(t.markers.length
          ? [...t.markers]
              .sort((a, b) => a.time - b.time)
              .map(
                (m) =>
                  `- ${timecode(m.time, p.fps)} (${m.time.toFixed(3)} s) [${m.kind}] ${escape(m.text)}`,
              )
          : ["No markers."]),
        "",
      );
      for (const r of t.references)
        lines.push(`- Reference: ${escape(r.name)} — refs/${r.id}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}
export async function exportArchive(
  project: Project,
  includeSources: boolean,
  onProgress: (text: string) => void,
) {
  const files: Record<string, Uint8Array> = {
    "project.json": strToU8(JSON.stringify(project, null, 2)),
    "record.md": strToU8(reportMarkdown(project)),
  };
  let size = files["project.json"].byteLength + files["record.md"].byteLength;
  const append = async (name: string, blob: Blob) => {
    size += blob.size;
    if (size > LIMIT)
      throw new Error(
        "This archive exceeds 512 MB. Export without source videos, and copy your original files separately.",
      );
    files[name] = new Uint8Array(await blob.arrayBuffer());
  };
  for (const [index, t] of project.takes.entries()) {
    onProgress(`${index + 1} / ${project.takes.length}`);
    if (includeSources) {
      let blob = await readMedia(t.id);
      if (!blob && t.demo) {
        const response = await fetch(demoUrl(t.demo));
        if (response.ok) blob = await response.blob();
      }
      if (!blob)
        throw new Error(
          `Missing source: ${t.name}. Relink it first or export without videos.`,
        );
      await append(`media/${t.id}`, blob);
    }
    for (const r of t.references) {
      const blob = await readMedia(r.id);
      if (!blob)
        throw new Error(
          `Missing reference image: ${r.name}. Relink or remove it before exporting a backup.`,
        );
      await append(`refs/${r.id}`, blob);
    }
  }
  return new Promise<Blob>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error
        ? reject(error)
        : resolve(
            new Blob([data as Uint8Array<ArrayBuffer>], {
              type: "application/zip",
            }),
          ),
    ),
  );
}
export async function importArchive(
  file: File,
): Promise<{ project: Project; media: Map<string, Blob> }> {
  if (file.size > LIMIT + 10 * 1024 * 1024)
    throw new Error("Project archives must be smaller than 522 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let total = 0;
  let count = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      count++;
      total += entry.originalSize;
      if (count > 10000 || total > LIMIT)
        throw new Error("Archive exceeds the safe extraction limit.");
      if (
        entry.name === "project.json" &&
        entry.originalSize > 10 * 1024 * 1024
      )
        throw new Error("Project record is too large.");
      return (
        entry.name === "project.json" ||
        /^(media|refs)\/[\w-]+$/.test(entry.name)
      );
    },
  });
  if (!files["project.json"])
    throw new Error("This ZIP does not contain a TakeLab project.json.");
  const project = parseProject(JSON.parse(strFromU8(files["project.json"])));
  const media = new Map<string, Blob>();
  for (const take of project.takes) {
    if (files[`media/${take.id}`])
      media.set(
        take.id,
        new Blob([files[`media/${take.id}`] as Uint8Array<ArrayBuffer>], {
          type: take.type,
        }),
      );
    for (const ref of take.references)
      if (files[`refs/${ref.id}`])
        media.set(
          ref.id,
          new Blob([files[`refs/${ref.id}`] as Uint8Array<ArrayBuffer>], {
            type: ref.type,
          }),
        );
  }
  return { project, media };
}
