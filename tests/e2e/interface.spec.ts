import { test, expect } from "@playwright/test";

test("comparison can expand without remounting players and return to a focused marker", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".empty-preview img")).toHaveCount(3);
  await expect(page.locator(".inspector")).toBeHidden();
  await expect(page.getByRole("group", { name: "Filter takes" })).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Play all", exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: info.outputPath("empty.png"), fullPage: true });
  await page.getByRole("button", { name: "Or explore a 9-take demo" }).click();
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
});
