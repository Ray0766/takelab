import { test, expect } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";

const source = path.resolve("public/demo/orbit-01.mp4");
async function demo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the sample project" }).click();
  await expect(page.getByTestId("take-card")).toHaveCount(9);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.every((v) => (v as HTMLVideoElement).readyState >= 2),
        ),
    )
    .toBe(true);
}

test("nine-way playback, frame stepping, decisions, blind review and persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await demo(page);
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          Math.min(...videos.map((v) => (v as HTMLVideoElement).currentTime)),
        ),
    )
    .toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const times = await page
    .locator("video")
    .evaluateAll((v) => v.map((x) => (x as HTMLVideoElement).currentTime));
  expect(Math.max(...times) - Math.min(...times)).toBeLessThan(0.16);
  await page.getByRole("slider", { name: "Timeline", exact: true }).fill("1");
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(page.getByTestId("timecode")).toHaveText("00:01:01");
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(25 / 24, 1);
  await page
    .getByRole("button", { name: "Reject B · Take 02", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Shortlist C · Take 03", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Select winner G · Take 07", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect G · Take 07", exact: true })
    .click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    /slow orbital approach/,
  );
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page.getByLabel("Marker note").fill("Ring is stable at this frame.");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.locator(".marker-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Blind mode", exact: true }).click();
  await expect(
    page.getByText("orbit_take_07.mp4", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Generation record", exact: true })
    .click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal identities", exact: true })
    .click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("take-card")).toHaveCount(9);
  await expect(page.locator(".take-card.winner")).toHaveCount(1);
  await expect(page.locator(".take-card.rejected")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("import source, notes and reference; export and restore a portable project", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByTestId("video-input").setInputFiles(source);
  await expect(page.getByTestId("take-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByLabel("Prompt", { exact: true }).fill("Portable test prompt");
  await page.getByLabel("Cost (USD)", { exact: true }).fill("0.45");
  await page.getByTestId("reference-input").setInputFiles({
    name: "reference.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".reference-image img")).toHaveCount(1);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByLabel("Include original videos (up to 512 MB)").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export project ZIP" }).click();
  const download = await downloadPromise;
  const archive = testInfo.outputPath("project.takelab.zip");
  await download.saveAs(archive);
  expect((await fs.stat(archive)).size).toBeGreaterThan(28000);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Project menu", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "New project Start with a clean desk" })
    .click();
  await expect(page.getByTestId("take-card")).toHaveCount(0);
  await page.getByTestId("archive-input").setInputFiles(archive);
  await expect(page.getByTestId("take-card")).toHaveCount(1);
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    "Portable test prompt",
  );
  await expect(page.getByLabel("Cost (USD)", { exact: true })).toHaveValue(
    "0.45",
  );
  await expect(page.locator(".reference-image img")).toHaveCount(1);
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await page.reload();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    "Portable test prompt",
  );
});

test("comparison exports a real playable video and readable record", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const reportPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export record", exact: true })
    .click();
  const report = await reportPromise;
  const reportPath = testInfo.outputPath("record.md");
  await report.saveAs(reportPath);
  expect(await fs.readFile(reportPath, "utf8")).toContain(
    "slow orbital approach",
  );
  const videoPromise = page.waitForEvent("download", { timeout: 30000 });
  await page
    .getByRole("button", { name: "Export comparison", exact: true })
    .click();
  const video = await videoPromise;
  const videoPath = testInfo.outputPath(video.suggestedFilename());
  await video.saveAs(videoPath);
  expect((await fs.stat(videoPath)).size).toBeGreaterThan(15000);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("video-input").setInputFiles(videoPath);
  await expect(page.getByTestId("take-card")).toHaveCount(9);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByTestId("take-card")).toHaveCount(1);
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(0);
});

test("pagination bounds decoders, filters work, responsive layouts fit", async ({
  page,
}, testInfo) => {
  await demo(page);
  await page.getByRole("button", { name: "4 view", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(4);
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Inspect E · Take 05", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "9 view", exact: true }).click();
  await page
    .getByRole("button", { name: "Reject B · Take 02", exact: true })
    .click();
  await page.getByLabel("Hide rejected").check();
  await expect(page.locator("video")).toHaveCount(8);
  await page.getByLabel("Hide rejected").uncheck();
  await page
    .getByRole("button", { name: "Select winner G · Take 07", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inspect G · Take 07", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Dismiss", exact: true })
    .click({ timeout: 500 })
    .catch(() => {});
  await page.screenshot({
    path: testInfo.outputPath("desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Export", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch language", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "导出", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "导出", exact: true }),
  ).toBeVisible();
});

test("invalid archive does not overwrite project and unsupported sources explain recovery", async ({
  page,
}) => {
  await demo(page);
  await page.getByTestId("archive-input").setInputFiles({
    name: "bad.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("not a zip"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("take-card")).toHaveCount(9);
  await page.getByTestId("video-input").setInputFiles({
    name: "broken.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("invalid video"),
  });
  await expect(page.getByRole("alert")).toContainText("codec not supported");
  await expect(page.getByTestId("take-card")).toHaveCount(9);
});

test("source offsets preserve marker time and take removal persists", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.getByLabel("Start offset (seconds)").fill("2");
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(2, 1);
  await page.getByRole("slider", { name: "Timeline", exact: true }).fill("1");
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page
    .getByLabel("Marker note")
    .fill("This note belongs to source second three.");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.locator(".marker-time")).toContainText("00:03:00");
  await page
    .getByRole("button", { name: "Generation record", exact: true })
    .click();
  await page
    .getByLabel("Move to shot")
    .selectOption({ label: "02 · Surface detail" });
  await page.getByRole("button", { name: /02 Surface detail 1 takes/ }).click();
  await expect(page.getByTestId("take-card")).toHaveCount(1);
  await expect(page.getByLabel("Start offset (seconds)")).toHaveValue("2");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByTestId("take-card")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: /02 Surface detail 0 takes/ }).click();
  await expect(page.getByTestId("take-card")).toHaveCount(0);
});

test("canceling recording restores the review players without a download", async ({
  page,
}) => {
  const errors: string[] = [];
  const downloads: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("download", (d) => downloads.push(d.suggestedFilename()));
  await demo(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("button", { name: "Export comparison", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Export comparison", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(9);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((v) =>
          v.every((x) => (x as HTMLVideoElement).readyState >= 2),
        ),
    )
    .toBe(true);
  expect(downloads).toEqual([]);
  expect(errors).toEqual([]);
});

test("metadata-only backup can relink its missing video", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByTestId("video-input").setInputFiles(source);
  await expect(page.getByTestId("take-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page
    .getByLabel("Prompt", { exact: true })
    .fill("Keep this recipe when relinking.");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const promise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project ZIP", exact: true })
    .click();
  const file = await promise;
  const zipPath = testInfo.outputPath("metadata.zip");
  await file.saveAs(zipPath);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("archive-input").setInputFiles(zipPath);
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toBeVisible();
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Relink video", exact: true }).click();
  await (await choose).setFiles(source);
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    "Keep this recipe when relinking.",
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((v) => (v as HTMLVideoElement).readyState),
    )
    .toBeGreaterThanOrEqual(2);
});
