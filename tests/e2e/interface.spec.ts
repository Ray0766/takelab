import { test, expect } from "@playwright/test";

test("comparison can expand without remounting players and return to a focused marker", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.fonts.check('600 34px "Bricolage Grotesque"'),
      ),
    )
    .toBe(true);
  await expect(page.locator(".empty-preview img")).toHaveCount(3);
  await expect(page.locator(".inspector")).toBeHidden();
  await expect(page.getByRole("group", { name: "Filter takes" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Play all", exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: info.outputPath("empty.png"), fullPage: true });
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
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluateAll((videos) =>
          videos.every((v) => !v.seeking && Math.abs(v.currentTime - 3) < 0.01),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("comparison.png"),
    fullPage: true,
  });
  await expect(page.locator(".inspector")).toBeHidden();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  const player = await page.locator("video").first().elementHandle();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Details", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".inspector")).toBeHidden();
  await expect(page.locator("video")).toHaveCount(9);
  expect(await player!.evaluate((v) => v.isConnected)).toBe(true);
  // Selecting a different comparison must not reopen the panel unexpectedly.
  await page.locator(".take-card-footer").nth(1).click();
  await expect(page.locator(".inspector")).toBeHidden();
  await page.screenshot({
    path: info.outputPath("expanded.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await expect(page.getByLabel("Marker note")).toBeFocused();
  await page
    .getByLabel("Marker note")
    .fill("Synthetic demo: compare the ring at 3 seconds.");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await expect(page.locator(".marker-time")).toContainText("00:03:00");
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    await page
      .locator(".take-visual")
      .first()
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(120);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("compact.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Details", exact: true })
    .press("Enter");
  await expect(page.locator(".marker-time")).toContainText("00:03:00");
  expect(await player!.evaluate((v) => v.isConnected)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Select winner G · Take 07", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Selected G Review decision", exact: true })
    .click();
  await expect(page.getByLabel("Why this take?")).toBeVisible();
  await expect(page.locator(".take-card.active")).toContainText(
    "orbit_take_07",
  );
  await expect(page.getByTestId("timecode")).toHaveText("00:03:00");
  expect(await player!.evaluate((v) => v.isConnected)).toBe(true);
  await page
    .getByRole("button", { name: "Close details", exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath("selected-overview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "4 view", exact: true }).click();
  await expect(page.locator("video")).toHaveCount(4);
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
          videos.every((v) => !v.seeking && Math.abs(v.currentTime - 3) < 0.01),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("four-up.png"),
    fullPage: true,
    animations: "disabled",
  });
  // Every footer must sit outside its source image, with no row overlap.
  const bounds = await page.locator(".take-card").evaluateAll((cards) =>
    cards.map((card) => {
      const visual = card
        .querySelector(".take-visual")!
        .getBoundingClientRect();
      const footer = card
        .querySelector(".take-card-footer")!
        .getBoundingClientRect();
      return {
        top: visual.top,
        bottom: visual.bottom,
        footerTop: footer.top,
        footerBottom: footer.bottom,
      };
    }),
  );
  for (const b of bounds)
    expect(b.footerTop).toBeGreaterThanOrEqual(b.bottom - 1);
  expect(bounds[2].top).toBeGreaterThan(bounds[0].footerBottom);
  // The selected take can be on another page; the shortcut must reveal it.
  await page
    .getByRole("button", { name: "Selected G Review decision", exact: true })
    .click();
  await expect(page.locator(".take-card.active")).toContainText(
    "orbit_take_07",
  );
  await expect(page.getByTestId("timecode")).toHaveText("00:03:00");
  await expect(page.locator("video")).toHaveCount(4);
  await page
    .getByLabel("Shot name")
    .fill("Very long shot name / 雨夜街道上的长镜头与多次生成版本");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
