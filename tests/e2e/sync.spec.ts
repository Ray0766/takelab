import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";

const fixtures = [24, 30].map((fps) =>
  path.resolve(`.local/sync-fixtures/sync-${fps}.mp4`),
);
// Optional host benchmark; generate fixtures first. Functional playback also runs in workbench.spec.ts.
test.skip(
  !fixtures.every(existsSync),
  "Run node scripts/generate-sync-fixtures.mjs for the 1080p benchmark",
);

async function measure(page: Page, offsets: number[], ms = 2500) {
  return page.evaluate(
    async ({ offsets, ms }) => {
      const videos = [...document.querySelectorAll("video")];
      const latest = videos.map(() => ({
        media: NaN,
        at: 0,
        expected: 0,
        submitted: 0,
      }));
      const events: {
        player: number;
        at: number;
        media: number;
        clock: number;
        expected: number;
        submitted: number;
        processing: number;
        presented: number;
      }[] = [];
      const handles = videos.map(() => 0);
      const before = videos.map((v) => v.getVideoPlaybackQuality());
      const samples: {
        clock: number;
        presented: number;
        age: number;
        at: number;
        players: {
          clock: number;
          media: number;
          callbackAge: number;
          displayAge: number;
        }[];
      }[] = [];
      let stopped = false;
      videos.forEach((v, i) => {
        const frame: VideoFrameRequestCallback = (now, meta) => {
          latest[i] = {
            media: meta.mediaTime,
            at: now,
            expected: meta.expectedDisplayTime,
            submitted: meta.presentationTime,
          };
          events.push({
            player: i,
            at: now,
            media: meta.mediaTime,
            clock: v.currentTime,
            expected: meta.expectedDisplayTime,
            submitted: meta.presentationTime,
            processing: meta.processingDuration,
            presented: meta.presentedFrames,
          });
          if (!stopped) handles[i] = v.requestVideoFrameCallback(frame);
        };
        handles[i] = v.requestVideoFrameCallback(frame);
      });
      const started = performance.now();
      while (performance.now() - started < ms) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (performance.now() - started < 350) continue;
        const active = videos
          .map((v, i) => ({ v, i }))
          .filter(({ v }) => v.currentTime < v.duration - 0.1);
        if (
          active.length !== videos.length ||
          videos.some((v) => v.seeking || v.readyState < 3) ||
          latest.some((f) => !Number.isFinite(f.media))
        )
          continue;
        const clocks = active.map(({ v, i }) => v.currentTime - offsets[i]);
        const frames = active.map(({ i }) => latest[i].media - offsets[i]);
        samples.push({
          clock: Math.max(...clocks) - Math.min(...clocks),
          presented: Math.max(...frames) - Math.min(...frames),
          age: Math.max(...latest.map((f) => performance.now() - f.at)),
          at: performance.now(),
          players: videos.map((v, i) => ({
            clock: v.currentTime - offsets[i],
            media: latest[i].media - offsets[i],
            callbackAge: performance.now() - latest[i].at,
            displayAge: performance.now() - latest[i].expected,
          })),
        });
      }
      stopped = true;
      videos.forEach((v, i) => v.cancelVideoFrameCallback(handles[i]));
      const stats = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          p95Ms: (sorted[Math.floor(sorted.length * 0.95)] || 0) * 1000,
          maxMs: (sorted.at(-1) || 0) * 1000,
        };
      };
      return {
        samples: samples.length,
        clock: stats(samples.map((s) => s.clock)),
        presented: stats(samples.map((s) => s.presented)),
        callbackAgeMaxMs: Math.max(...samples.map((s) => s.age)),
        frames: videos.map((v, i) => {
          const after = v.getVideoPlaybackQuality();
          return {
            decoded: after.totalVideoFrames - before[i].totalVideoFrames,
            dropped: after.droppedVideoFrames - before[i].droppedVideoFrames,
          };
        }),
        heapBytes: (
          performance as Performance & { memory?: { usedJSHeapSize: number } }
        ).memory?.usedJSHeapSize,
        raw: samples,
        frameEvents: events,
      };
    },
    { offsets, ms },
  );
}

test("measure mixed-fps 1080p synchronization, offsets, pause, seek, audio, ending and loop", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(120000);
  const results: Record<string, unknown> = {
    browser: browser.version(),
    resolution: "1920x1080",
    measuredAt: new Date().toISOString(),
    gate:
      process.env.TAKELAB_SYNC_GATE === "strict" ? "strict-p95" : "regression",
  };
  await page.goto("/");
  await page.getByTestId("video-input").setInputFiles(fixtures[0]);
  await expect(page.locator("video")).toHaveCount(1);
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  results.single = await measure(page, [0]);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByTestId("video-input").setInputFiles(fixtures[1]);
  await expect(page.locator("video")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Inspect B · Take 02", exact: true })
    .click();
  await page.getByLabel("Start offset (seconds)").fill("0.5");
  for (const rate of [1, 0.5, 2]) {
    await page.getByRole("slider", { name: "Timeline", exact: true }).fill("0");
    await page.getByLabel("Playback speed").selectOption(String(rate));
    await page.getByRole("button", { name: "Play all", exact: true }).click();
    results[`dual-${rate}x`] = await measure(
      page,
      [0, 0.5],
      rate === 2 ? 2000 : 3000,
    );
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  }
  await page.getByLabel("Playback speed").selectOption("1");
  await page.evaluate(() => {
    const state = window as typeof window & { seekFrames: (number | null)[] };
    state.seekFrames = [null, null];
    document.querySelectorAll("video").forEach((video, i) => {
      const observe: VideoFrameRequestCallback = (_now, frame) => {
        // A callback for the previous pause/rate change can still be queued.
        // Keep observing until the requested seek frame actually arrives.
        if (Math.abs(frame.mediaTime - (2 + i * 0.5)) <= 1 / 24)
          state.seekFrames[i] = frame.mediaTime;
        else video.requestVideoFrameCallback(observe);
      };
      video.requestVideoFrameCallback(observe);
    });
  });
  const started = Date.now();
  await page.getByRole("slider", { name: "Timeline", exact: true }).fill("2");
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((vs) =>
          vs.every(
            (v, i) =>
              !v.seeking && Math.abs(v.currentTime - (2 + i * 0.5)) < 1 / 24,
          ),
        ),
    )
    .toBe(true);
  results.seekSettleMs = Date.now() - started;
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { seekFrames: (number | null)[] }
        ).seekFrames.every((time) => time !== null),
      ),
    )
    .toBe(true);
  const seekFrames = await page.evaluate(
    () => (window as typeof window & { seekFrames: number[] }).seekFrames,
  );
  results.pausedPresentedTimes = seekFrames;
  results.presentedSeekSettleMs = Date.now() - started;
  expect(Math.abs(seekFrames[0] - (seekFrames[1] - 0.5))).toBeLessThanOrEqual(
    1 / 24,
  );
  const paused = await page
    .locator("video")
    .evaluateAll((vs) =>
      vs.map((v) => ({ time: v.currentTime, paused: v.paused })),
    );
  expect(paused.every((v) => v.paused)).toBe(true);
  await page.getByRole("button", { name: "Next frame", exact: true }).click();
  await expect(page.getByTestId("timecode")).toHaveText("00:02:01");
  await page
    .getByRole("button", { name: "Listen to this take", exact: true })
    .click();
  expect(
    await page.locator("video").evaluateAll((vs) => vs.map((v) => v.muted)),
  ).toEqual([true, false]);
  await page
    .getByRole("button", { name: "Inspect A · Take 01", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Listen to this take", exact: true })
    .click();
  expect(
    await page.locator("video").evaluateAll((vs) => vs.map((v) => v.muted)),
  ).toEqual([false, true]);
  await page
    .getByRole("slider", { name: "Timeline", exact: true })
    .fill("4.75");
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.currentTime),
    )
    .toBeGreaterThan(5.2);
  results.ended = await page
    .locator("video")
    .evaluateAll((vs) =>
      vs.map((v) => ({ time: v.currentTime, paused: v.paused })),
    );
  expect((results.ended as { time: number; paused: boolean }[])[1].paused).toBe(
    true,
  );
  expect((results.ended as { time: number }[])[1].time).toBeGreaterThan(4.95);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .getByRole("button", { name: "Loop playback", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Timeline", exact: true })
    .fill("7.875");
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play all", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("timecode")).toHaveText("00:08:00");
  await page
    .getByRole("button", { name: "Loop playback", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Timeline", exact: true })
    .fill("7.875");
  await page.getByRole("button", { name: "Play all", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => v.currentTime),
    )
    .toBeLessThan(1);
  results.loop = await measure(page, [0, 0.5], 1500);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("sync-1080p.png"),
    fullPage: true,
  });
  results.targets = Object.fromEntries(
    ["dual-1x", "dual-0.5x", "dual-2x", "loop"].map((key) => {
      const measured = results[key] as Awaited<ReturnType<typeof measure>>;
      const targetP95Ms = key === "dual-2x" ? 84 : 80;
      return [
        key,
        { targetP95Ms, met: measured.presented.p95Ms <= targetP95Ms },
      ];
    }),
  );
  await fs.writeFile(
    info.outputPath("sync-measurement.json"),
    JSON.stringify(results, null, 2),
  );
  for (const key of ["dual-1x", "dual-0.5x", "dual-2x", "loop"]) {
    const result = results[key] as Awaited<ReturnType<typeof measure>>;
    expect(result.samples, key).toBeGreaterThan(10);
    const p95Target = key === "dual-2x" ? 84 : 80;
    if (result.presented.p95Ms > p95Target)
      info.annotations.push({
        type: "quality-target-miss",
        description: `${key}: ${result.presented.p95Ms.toFixed(1)} ms p95 exceeds ${p95Target} ms`,
      });
    if (process.env.TAKELAB_SYNC_GATE === "strict")
      expect
        .soft(result.presented.p95Ms, `${key}: strict quality target`)
        .toBeLessThanOrEqual(p95Target);
    // The predeclared 80/84 ms target remains in the receipt, including misses.
    // Guard functional regressions separately from host/compositor-sensitive p95.
    expect(result.clock.p95Ms, key).toBeLessThanOrEqual(100);
    expect(result.presented.maxMs, key).toBeLessThanOrEqual(150);
  }
  expect(results.seekSettleMs).toBeLessThanOrEqual(750);
});
