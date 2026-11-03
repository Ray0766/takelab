import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

test("bundled demo seeks on a static host that returns full files without Range support", async ({
  page,
}, info) => {
  await page.route("**/demo/*.mp4", async (route) => {
    const file = path.basename(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: 200,
      contentType: "video/mp4",
      body: await fs.readFile(path.resolve("public/demo", file)),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open the sample project" }).click();
  await expect(page.locator("video")).toHaveCount(9);
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) => videos.every((v) => v.readyState >= 2)),
    )
    .toBe(true);
  await page.getByRole("slider", { name: "Timeline", exact: true }).fill("3");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.every(
            (v) => !v.seeking && Math.abs(v.currentTime - 3) < 0.001,
          ),
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.every(
            (v) => !v.seeking && Math.abs(v.currentTime - (3 + 1 / 24)) < 0.001,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("static-host-seek.png"),
    fullPage: true,
  });
});

test("pausing between UI updates keeps displayed time, source and marker together", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open the sample project" }).click();
  await page.getByRole("button", { name: "1 view", exact: true }).click();
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.readyState))
    .toBe(4);
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  // Exercise the real pause button exactly in the window between media progress
  // and the throttled React time readout. A normal click can hit this window too.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const started = performance.now();
        const tick = () => {
          const video = document.querySelector("video")!;
          const [m, s, f] = document
            .querySelector('[data-testid="timecode"]')!
            .textContent!.split(":")
            .map(Number);
          const displayed = m * 60 + s + f / 24;
          if (
            video.currentTime > 0.4 &&
            video.currentTime - displayed > 0.025 &&
            video.currentTime - displayed < 0.038
          ) {
            (
              document.querySelector(
                '[aria-label="Pause"]',
              ) as HTMLButtonElement
            ).click();
            resolve();
          } else if (performance.now() - started > 5000)
            reject(
              new Error("Could not exercise the between-update pause window"),
            );
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  await expect(
    page.getByRole("button", { name: "Play all", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.paused && !v.seeking))
    .toBe(true);
  const position = await page.locator("video").evaluate((v) => v.currentTime);
  const readout = await page.getByTestId("timecode").innerText();
  const [m, s, f] = readout.split(":").map(Number);
  expect(Math.round(position * 24)).toBe(m * 60 * 24 + s * 24 + f);
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page
    .getByLabel("Marker note")
    .fill("Observation at the paused comparison position.");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.locator(".marker-time")).toContainText(readout);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await page.locator(".marker-time").click();
  await expect
    .poll(() => page.locator("video").evaluate((v) => v.currentTime))
    .toBeCloseTo(position, 3);
  await page.screenshot({
    path: info.outputPath("pause-evidence.png"),
    fullPage: true,
  });
});
