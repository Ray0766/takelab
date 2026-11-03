import { test, expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import fs from "node:fs/promises";
import path from "node:path";
import type { Project } from "../../src/model";

test("winner → cross-candidate evidence → generation record survives export, restore and relink", async ({
  page,
}, info) => {
  await page.goto("/");
  await page
    .getByTestId("video-input")
    .setInputFiles([
      path.resolve("public/demo/orbit-04.mp4"),
      path.resolve("public/demo/orbit-07.mp4"),
    ]);
  await expect(page.locator("video")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Inspect A · Take 01", exact: true })
    .click();
  await page
    .getByLabel("Prompt", { exact: true })
    .fill(
      "Synthetic test fixture: orbital view with a midpoint light flicker.",
    );
  await page.getByRole("slider", { name: "Timeline", exact: true }).fill("3");
  await page.getByRole("button", { name: "Add marker", exact: true }).click();
  await page
    .getByLabel("Marker note")
    .fill("Midpoint light flicker interrupts the shot.");
  await page.getByRole("button", { name: "Save marker", exact: true }).click();
  await page
    .getByRole("button", { name: "Reject A · Take 01", exact: true })
    .click();
  await expect(page.locator(".take-card.rejected video")).toHaveCSS(
    "opacity",
    "1",
  );
  await page
    .getByRole("button", { name: "Inspect B · Take 02", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generation record", exact: true })
    .click();
  await page
    .getByLabel("Prompt", { exact: true })
    .fill(
      "Synthetic test fixture: balanced orbital light and camera movement.",
    );
  await page
    .getByRole("button", { name: "Select winner B · Take 02", exact: true })
    .click();
  await page.getByRole("button", { name: "Decision", exact: true }).click();
  await page
    .getByLabel("Why this take?")
    .fill("Take 07 maintains steady lighting; Take 04 flickers at 3 seconds.");
  await page.locator(".evidence-item input").check();
  await expect(page.locator(".decision-status")).toContainText(
    "Reason and evidence linked",
  );
  await page.getByLabel("Hide rejected").check();
  await expect(page.locator("video")).toHaveCount(1);
  await page.locator(".evidence-time").click();
  await expect(page.locator(".take-card.active")).toContainText("orbit-04");
  await expect(page.getByTestId("timecode")).toHaveText("00:03:00");
  await expect
    .poll(() =>
      page
        .locator("video")
        .first()
        .evaluate((v) => (v as HTMLVideoElement).currentTime),
    )
    .toBeCloseTo(3, 2);
  await page.screenshot({
    path: info.outputPath("decision-desktop.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Open winner record", exact: true })
    .click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    /balanced orbital/,
  );
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project ZIP", exact: true })
    .click();
  const zipPath = info.outputPath("decision.takelab.zip");
  await (await wait).saveAs(zipPath);
  const files = unzipSync(await fs.readFile(zipPath));
  const project: Project = JSON.parse(strFromU8(files["project.json"]));
  const report = strFromU8(files["record.md"]);
  const [rejected, winner] = project.takes;
  expect(project.shots[0].decision).toEqual({
    takeId: winner.id,
    reason: "Take 07 maintains steady lighting; Take 04 flickers at 3 seconds.",
    evidence: [{ takeId: rejected.id, markerId: rejected.markers[0].id }],
  });
  expect(report).toContain(
    `Evidence ID: ${rejected.id}/${rejected.markers[0].id}`,
  );
  expect(report).toContain("source 3.000 s");
  expect(report).toContain(winner.prompt);
  await fs.writeFile(info.outputPath("record.md"), report);
  await fs.writeFile(
    info.outputPath("project.json"),
    JSON.stringify(project, null, 2),
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByTestId("archive-input").setInputFiles(zipPath);
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(2);
  const chooseWrong = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Relink video", exact: true })
    .first()
    .click();
  await (await chooseWrong).setFiles(path.resolve("public/demo/orbit-07.mp4"));
  await expect(page.getByRole("alert")).toContainText("does not match");
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(2);
  for (const filename of ["orbit-04.mp4", "orbit-07.mp4"]) {
    const choose = page.waitForEvent("filechooser");
    await page
      .getByRole("button", { name: "Relink video", exact: true })
      .first()
      .click();
    await (await choose).setFiles(path.resolve(`public/demo/${filename}`));
    await expect(
      page.getByRole("status").filter({ hasText: "Source relinked." }),
    ).toBeVisible();
  }
  await expect(
    page.getByText("Source unavailable", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Decision", exact: true }).click();
  await expect(page.getByLabel("Why this take?")).toHaveValue(
    project.shots[0].decision!.reason,
  );
  await expect(page.locator(".evidence-item input")).toBeChecked();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByLabel("Include original videos (up to 512 MB)").check();
  const portableWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project ZIP", exact: true })
    .click();
  const portablePath = info.outputPath("decision-with-media.takelab.zip");
  await (await portableWait).saveAs(portablePath);
  const portable = unzipSync(await fs.readFile(portablePath));
  for (const take of project.takes)
    expect(Buffer.from(portable[`media/${take.id}`])).toEqual(
      await fs.readFile(path.resolve(`public/demo/${take.name}`)),
    );
  const comparisonWait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export comparison", exact: true })
    .click();
  const comparison = await comparisonWait;
  await comparison.saveAs(info.outputPath("decision-comparison.webm"));
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Blind mode", exact: true }).click();
  await expect(page.getByLabel("Why this take?")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reveal identities", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 720, height: 500 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Why this take?").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(".evidence-item input")).toBeFocused();
  await page.screenshot({
    path: info.outputPath("decision-zoom-equivalent.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Switch language", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "选片依据", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("decision-mobile-zh.png"),
    fullPage: true,
  });
});
