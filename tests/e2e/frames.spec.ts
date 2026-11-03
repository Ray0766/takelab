import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { unzipSync, zipSync, strFromU8 } from "fflate";
import type { Project } from "../../src/model";

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const inspection = (page: Page) =>
  page.getByRole("dialog", { name: "Source-frame inspection", exact: true });
async function settled(page: Page) {
  await expect(
    inspection(page).locator(".source-progress"),
  ).not.toHaveAttribute("data-reader-error", /.+/);
  await expect(
    inspection(page).getByRole("button", {
      name: "Next source frame A",
      exact: true,
    }),
  ).toBeEnabled();
}
async function archive(page: Page, output: string, include: boolean) {
  await button(page, "Export").click();
  await page
    .getByLabel("Include original videos (up to 512 MB)")
    .setChecked(include);
  const download = page.waitForEvent("download");
  await button(page, "Export project ZIP").click();
  await (await download).saveAs(output);
  await button(page, "Close").click();
  return unzipSync(await fs.readFile(output));
}
async function decisionPanel(page: Page) {
  if ((await button(page, "Details").getAttribute("aria-expanded")) !== "true")
    await button(page, "Details").click();
  await button(page, "Decision").click();
}

test("source frames → action anchors → screenshot → winner/recipe → portable restore and integrity failures", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByTestId("video-input")
    .setInputFiles([
      path.resolve("public/demo/orbit-04.mp4"),
      path.resolve("public/demo/orbit-07.mp4"),
    ]);
  await expect(page.locator("video")).toHaveCount(2);
  await button(page, "Inspect A · Take 01").click();
  await page
    .getByLabel("Prompt", { exact: true })
    .fill("Original synthetic orbit fixture; preserve source-frame evidence.");
  await button(page, "Inspect frames").click();
  await settled(page);
  await button(page, "Align action").click();
  await page.getByLabel("Source time A", { exact: true }).fill("");
  await page
    .getByLabel("Source time A", { exact: true })
    .pressSequentially("1.000");
  await page.getByLabel("Source time A", { exact: true }).press("Enter");
  await settled(page);
  await button(page, "Use this frame as anchor A").click();
  await page.getByLabel("Source time B", { exact: true }).fill("2");
  await page.getByLabel("Source time B", { exact: true }).press("Enter");
  await settled(page);
  await button(page, "Use this frame as anchor B").click();
  await page
    .getByLabel("Action name", { exact: true })
    .fill("Synthetic reference moment");
  await button(page, "Align these frames").click();
  await settled(page);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.map((v) => ({ time: v.currentTime, paused: v.paused })),
        ),
    )
    .toEqual([
      { time: 1, paused: true },
      { time: 2, paused: true },
    ]);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.000000",
  );
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "2.000000",
  );
  await page.screenshot({
    path: info.outputPath("anchors-desktop.png"),
    fullPage: true,
  });
  await button(page, "Next source frame A").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.041667",
  );
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "2.041667",
  );
  await button(page, "Select winner B").click();
  await page.getByLabel("Evidence source", { exact: true }).selectOption("0");
  await page.getByLabel("Linked zoom", { exact: true }).selectOption("2");
  await page
    .getByLabel("Frame observation", { exact: true })
    .fill(
      "Source-frame reference: inspect the original ring edge before choosing B.",
    );
  await button(page, "Save frame evidence").click();
  await expect(inspection(page).getByRole("status")).toContainText(
    "Frame evidence saved",
  );
  await page.screenshot({
    path: info.outputPath("inspection-desktop.png"),
    fullPage: true,
  });
  await button(page, "Decision & record").click();
  await button(page, "Open winner record").click();
  await page
    .getByLabel("Prompt", { exact: true })
    .fill(
      "Synthetic orbit B: retain the ring crossing and its source-frame comparison. No generation model used.",
    );
  await button(page, "Decision").click();
  await page
    .getByLabel("Why this take?", { exact: true })
    .fill(
      "B is selected; A's exact frame is retained as the comparison evidence.",
    );
  await expect(page.locator(".evidence-item input")).toBeChecked();
  await button(page, "View frame evidence").click();
  await expect(page.locator(".saved-frame-image")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("1.041667 s");
  const png = page.waitForEvent("download");
  await button(page, "Download PNG").click();
  await (await png).saveAs(info.outputPath("original-frame.png"));
  await page.screenshot({
    path: info.outputPath("evidence-desktop.png"),
    fullPage: true,
  });
  await button(page, "Close").click();
  const fullPath = info.outputPath("frames-full.takelab.zip");
  const files = await archive(page, fullPath, true);
  const p: Project = JSON.parse(strFromU8(files["project.json"]));
  const take = p.takes[0],
    marker = take.markers[0],
    frame = marker.frame!;
  expect(take.anchor?.ptsUs).toBe(1000000);
  expect(p.takes[1].anchor?.ptsUs).toBe(2000000);
  expect(take.offset).toBe(1);
  expect(p.takes[1].offset).toBe(2);
  expect(frame.ptsUs).toBe(1041667);
  expect(frame.sourceHash).toBe(
    createHash("sha256")
      .update(await fs.readFile("public/demo/orbit-04.mp4"))
      .digest("hex"),
  );
  expect(frame.pngHash).toBe(
    createHash("sha256")
      .update(files[`evidence/${frame.id}.png`])
      .digest("hex"),
  );
  expect(Buffer.from(files[`evidence/${frame.id}.png`])).toEqual(
    await fs.readFile(info.outputPath("original-frame.png")),
  );
  expect(p.shots[0].decision!.evidence).toEqual([
    { takeId: take.id, markerId: marker.id },
  ]);
  expect(strFromU8(files["record.md"])).toContain(`evidence/${frame.id}.png`);
  expect(strFromU8(files["record.md"])).toContain(take.prompt);
  expect(p.takes[1].prompt).toContain("Synthetic orbit B");
  expect(take.prompt).toBe(
    "Original synthetic orbit fixture; preserve source-frame evidence.",
  );
  expect(strFromU8(files["record.md"])).toContain(p.takes[1].prompt);
  await fs.writeFile(info.outputPath("project.json"), files["project.json"]);
  await fs.writeFile(info.outputPath("record.md"), files["record.md"]);
  // Replace the project through the real import flow, then reload browser storage.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("archive-input").setInputFiles(fullPath);
  await expect(
    page.getByRole("status").filter({ hasText: "Project restored" }),
  ).toBeVisible();
  await page.reload();
  await decisionPanel(page);
  await expect(page.getByLabel("Why this take?", { exact: true })).toHaveValue(
    p.shots[0].decision!.reason,
  );
  await button(page, "View frame evidence").click();
  await expect(page.locator(".saved-frame-image")).toBeVisible();
  await button(page, "Inspect original frame").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.041667",
  );
  await button(page, "Back to overview").click();
  // Invalid PNG and source bytes must not replace the existing valid project.
  for (const name of [`evidence/${frame.id}.png`, `media/${take.id}`]) {
    const altered = { ...files, [name]: files[name].slice() };
    altered[name][altered[name].length - 1] ^= 1;
    const bad = info.outputPath(
      name.startsWith("evidence") ? "bad-image.zip" : "bad-source.zip",
    );
    await fs.writeFile(bad, zipSync(altered));
    await page.getByTestId("archive-input").setInputFiles(bad);
    await expect(page.getByRole("alert")).toContainText(/fingerprint/i);
    await expect(
      page.getByLabel("Why this take?", { exact: true }),
    ).toHaveValue(p.shots[0].decision!.reason);
    await button(page, "Dismiss").click();
  }
  const metadataPath = info.outputPath("frames-records-only.takelab.zip");
  await archive(page, metadataPath, false);
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("archive-input").setInputFiles(metadataPath);
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(2);
  await decisionPanel(page);
  await button(page, "View frame evidence").click();
  await expect(page.locator(".saved-frame-image")).toBeVisible();
  await expect(button(page, "Inspect original frame")).toBeDisabled();
  await button(page, "Close").click();
  const original = await fs.readFile("public/demo/orbit-04.mp4");
  const wrong = Buffer.from(original);
  wrong[wrong.length - 1] ^= 1;
  let chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Relink video", exact: true })
    .first()
    .click();
  await (
    await chooser
  ).setFiles({ name: "orbit-04.mp4", mimeType: "video/mp4", buffer: wrong });
  await expect(page.getByRole("alert")).toContainText("different contents");
  await button(page, "Dismiss").click();
  chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Relink video", exact: true })
    .first()
    .click();
  await (await chooser).setFiles(path.resolve("public/demo/orbit-04.mp4"));
  await expect(
    page.getByRole("status").filter({ hasText: "Source relinked" }),
  ).toBeVisible();
  await button(page, "View frame evidence").click();
  await button(page, "Inspect original frame").click();
  await button(page, "Inspect A only").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.041667",
  );
  await button(page, "Back to overview").click();
  // Restore both sources for responsive inspection and blind metadata checks.
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("archive-input").setInputFiles(fullPath);
  await expect(
    page.getByRole("status").filter({ hasText: "Project restored" }),
  ).toBeVisible();
  await button(page, "Blind mode").click();
  await button(page, "Inspect frames").click();
  await settled(page);
  await expect(inspection(page)).not.toContainText("orbit-04");
  await expect(inspection(page)).not.toContainText("orbit-07");
  await expect(inspection(page)).not.toContainText(
    "Synthetic reference moment",
  );
  await button(page, "Back to overview").click();
  await button(page, "Reveal identities").click();
  await button(page, "Switch language").click();
  await button(page, "检查源帧").click();
  await expect(button(page, "下一源帧 A")).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("inspection-mobile-zh.png"),
  });
  await page
    .getByRole("button", { name: "保存源帧证据", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("inspection-mobile-form-zh.png"),
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("VFR source steps use real frame boundaries and rapid seeks cannot save a stale frame", async ({
  page,
}, info) => {
  test.skip(
    !existsSync(".local/frame-fixtures/vfr.mp4"),
    "Run npm run test:frames to generate FFmpeg fixtures",
  );
  await page.goto("/");
  await page
    .getByTestId("video-input")
    .setInputFiles([
      path.resolve(".local/frame-fixtures/vfr.mp4"),
      path.resolve(".local/frame-fixtures/cfr.mp4"),
    ]);
  await expect(page.locator("video")).toHaveCount(2);
  await button(page, "Inspect frames").click();
  await settled(page);
  await page.getByLabel("Source B", { exact: true }).selectOption("");
  await settled(page);
  await page
    .getByLabel("Source A", { exact: true })
    .selectOption({ label: "vfr.mp4" });
  await settled(page);
  await page
    .getByLabel("Source B", { exact: true })
    .selectOption({ label: "cfr.mp4" });
  await settled(page);
  await page.getByLabel("Source time A", { exact: true }).fill("1");
  await page.getByLabel("Source time A", { exact: true }).press("Enter");
  await settled(page);
  await button(page, "Next source frame A").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.100000",
  );
  await expect(page.locator("canvas").first()).toHaveAttribute(
    "data-frame-index",
    "31",
  );
  await button(page, "Previous source frame A").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.000000",
  );
  for (const at of ["0.2", "1.8", "0.4", "1.5", "1.101"])
    await page.getByLabel("Inspection timeline", { exact: true }).fill(at);
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.100000",
  );
  const code = await page
    .locator("canvas")
    .first()
    .evaluate((c) => {
      const ctx = (c as HTMLCanvasElement).getContext("2d")!;
      let n = 0;
      for (let i = 0; i < 8; i++)
        if (ctx.getImageData(i * 80 + 40, 40, 1, 1).data[0] > 128) n |= 1 << i;
      return n;
    });
  expect(code).toBe(33);
  await page
    .getByLabel("Frame observation", { exact: true })
    .fill("VFR original frame 33 at 1.1 seconds.");
  await button(page, "Save frame evidence").click();
  await expect(inspection(page).getByRole("status")).toContainText(
    "Frame evidence saved",
  );
  await page.screenshot({
    path: info.outputPath("vfr-source-frames.png"),
    fullPage: true,
  });
  await button(page, "Back to overview").click();
  const files = await archive(page, info.outputPath("vfr.takelab.zip"), true);
  const p: Project = JSON.parse(strFromU8(files["project.json"]));
  expect(
    p.takes.find((t) => t.name === "vfr.mp4")!.markers[0].frame!.ptsUs,
  ).toBe(1100000);
  const evidence = p.takes.find((t) => t.name === "vfr.mp4")!.markers[0].frame!;
  expect(
    await page.evaluate(
      async (bytes) => {
        const bitmap = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        let code = 0;
        for (let i = 0; i < 8; i++)
          if (ctx.getImageData(i * 80 + 40, 40, 1, 1).data[0] > 128)
            code |= 1 << i;
        const result = { width: bitmap.width, height: bitmap.height, code };
        bitmap.close();
        return result;
      },
      Array.from(files[`evidence/${evidence.id}.png`]),
    ),
  ).toEqual({ width: 640, height: 360, code: 33 });
});

test("60 fps boundaries, rotated source pixels and explicit nonzero-start fallback", async ({
  page,
}, info) => {
  test.skip(
    !existsSync(".local/frame-fixtures/60fps.mp4"),
    "Run npm run test:frames",
  );
  await page.goto("/");
  await page
    .getByTestId("video-input")
    .setInputFiles([
      path.resolve(".local/frame-fixtures/60fps.mp4"),
      path.resolve(".local/frame-fixtures/rotated.mp4"),
      path.resolve(".local/frame-fixtures/nonzero.mp4"),
    ]);
  await expect(page.locator("video")).toHaveCount(3);
  await button(page, "Inspect frames").click();
  await page.getByLabel("Source B", { exact: true }).selectOption("");
  await page
    .getByLabel("Source A", { exact: true })
    .selectOption({ label: "60fps.mp4" });
  await settled(page);
  await page.getByLabel("Source time A", { exact: true }).fill("1");
  await page.getByLabel("Source time A", { exact: true }).press("Enter");
  await settled(page);
  for (const at of ["1.016667", "1.033333", "1.050000", "1.066667"]) {
    await button(page, "Next source frame A").click();
    await settled(page);
    await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
      at,
    );
  }
  await page
    .getByLabel("Source A", { exact: true })
    .selectOption({ label: "rotated.mp4" });
  await settled(page);
  await expect(page.locator("canvas")).toHaveAttribute("width", "360");
  await expect(page.locator("canvas")).toHaveAttribute("height", "640");
  await page.getByLabel("Source time A", { exact: true }).fill("1.1");
  await page.getByLabel("Source time A", { exact: true }).press("Enter");
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.100000",
  );
  // Rotation metadata is counter-clockwise: the original top barcode is now on the left.
  expect(
    await page.locator("canvas").evaluate((c) => {
      const ctx = (c as HTMLCanvasElement).getContext("2d")!;
      let code = 0;
      for (let i = 0; i < 8; i++)
        if (ctx.getImageData(40, 639 - (i * 80 + 40), 1, 1).data[0] > 128)
          code |= 1 << i;
      return code;
    }),
  ).toBe(33);
  await page.screenshot({
    path: info.outputPath("inspection-rotated.png"),
    fullPage: true,
  });
  await page
    .getByLabel("Source A", { exact: true })
    .selectOption({ label: "nonzero.mp4" });
  await expect(inspection(page).getByRole("status")).toContainText(
    "unsupported start time",
  );
  await expect(button(page, "Save frame evidence")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(3);
});

test("unsupported exact decoding leaves the nine-take overview intact and permits cancellation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "VideoDecoder", { value: undefined }),
  );
  await page.goto("/");
  await button(page, "Open the sample project").click();
  await expect(page.locator("video")).toHaveCount(9);
  await button(page, "Inspect frames").click();
  await expect(inspection(page).getByRole("status")).toContainText(
    "unavailable",
  );
  await expect(button(page, "Save frame evidence")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(9);
  await expect(button(page, "Inspect frames")).toBeFocused();
  await button(page, "Play all").click();
  await expect(button(page, "Pause")).toBeVisible();
});

test("mixed 24/30 fps, anchor undo, endpoint hold, VP9 and single-source cancellation", async ({
  page,
}, info) => {
  test.skip(
    !existsSync(".local/frame-fixtures/cfr.mp4"),
    "Run npm run test:frames",
  );
  await page.goto("/");
  await page
    .getByTestId("video-input")
    .setInputFiles([
      path.resolve("public/demo/orbit-04.mp4"),
      path.resolve(".local/frame-fixtures/cfr.mp4"),
      path.resolve(".local/frame-fixtures/vp9.webm"),
    ]);
  await expect(page.locator("video")).toHaveCount(3);
  await button(page, "Inspect frames").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await button(page, "Inspect frames").click();
  await settled(page);
  await page.getByLabel("Source B", { exact: true }).selectOption("");
  await settled(page);
  await page
    .getByLabel("Source A", { exact: true })
    .selectOption({ label: "orbit-04.mp4" });
  await settled(page);
  await page
    .getByLabel("Source B", { exact: true })
    .selectOption({ label: "cfr.mp4" });
  await settled(page);
  await page.getByLabel("Source time A", { exact: true }).fill("1");
  await page.getByLabel("Source time A", { exact: true }).press("Enter");
  await settled(page);
  await button(page, "Next source frame A").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "1.041667",
  );
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "1.033333",
  );
  await button(page, "Align action").click();
  await button(page, "Use this frame as anchor A").click();
  await button(page, "Use this frame as anchor B").click();
  await page
    .getByLabel("Action name", { exact: true })
    .fill("Synthetic matching frame");
  await button(page, "Align these frames").click();
  await settled(page);
  await button(page, "Undo alignment").click();
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "0.000000",
  );
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "0.000000",
  );
  await page.getByLabel("Inspection timeline", { exact: true }).fill("6");
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "5.958333",
  );
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "1.966667",
  );
  await expect(button(page, "Next source frame A")).toBeDisabled();
  await expect(inspection(page)).toContainText("Endpoint held");
  await page
    .getByLabel("Source B", { exact: true })
    .selectOption({ label: "vp9.webm" });
  await settled(page);
  await page.getByLabel("Source time B", { exact: true }).fill("1.1");
  await page.getByLabel("Source time B", { exact: true }).press("Enter");
  await settled(page);
  await expect(page.getByLabel("Source time B", { exact: true })).toHaveValue(
    "1.100000",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: info.outputPath("inspection-short-window.png"),
    fullPage: true,
  });
  await page.getByLabel("Source B", { exact: true }).selectOption("");
  await settled(page);
  await button(page, "Next source frame A").focus();
  await page.keyboard.press("ArrowRight");
  await settled(page);
  await expect(page.getByLabel("Source time A", { exact: true })).toHaveValue(
    "0.041667",
  );
  await page.screenshot({
    path: info.outputPath("inspection-single.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(3);
});
