// Serve the real build with ordinary HTTP 200 files (no byte-range handling).
import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";

const root = path.resolve("dist");
await fs.access(path.join(root, "index.html"));
for (const name of [
  "cfr.mp4",
  "vfr.mp4",
  "60fps.mp4",
  "rotated.mp4",
  "nonzero.mp4",
  "vp9.webm",
])
  await fs.access(path.resolve(".local/frame-fixtures", name)).catch(() => {
    throw new Error(
      "Run node scripts/generate-frame-fixtures.mjs before the production frame checks.",
    );
  });
const output = path.resolve(".local/source-frames-production");
await fs.mkdir(output, { recursive: true });
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (req, res) => {
  try {
    let name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (name.startsWith("/takelab/")) name = name.slice(8);
    if (name.endsWith("/")) name += "index.html";
    const file = path.resolve(root, "." + name);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const config = path.resolve(".local/frame-production.config.mjs");
  await fs.writeFile(
    config,
    "export default " +
      JSON.stringify(
        {
          testDir: path.resolve("tests/e2e"),
          testMatch: "frames.spec.ts",
          workers: 1,
          timeout: 45000,
          expect: { timeout: 10000 },
          reporter: [["list"]],
          outputDir: output,
          use: {
            baseURL: origin,
            viewport: { width: 1440, height: 1000 },
            locale: "en-US",
            trace: "retain-on-failure",
            screenshot: "only-on-failure",
            acceptDownloads: true,
            launchOptions: {
              args: ["--autoplay-policy=no-user-gesture-required"],
            },
          },
        },
        null,
        2,
      ),
  );
  const exit = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", "test", "--config", config],
      { stdio: "inherit" },
    );
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (exit !== 0)
    throw new Error(`Production source-frame checks failed (${exit})`);
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: "en-US",
  });
  const workers = [],
    errors = [];
  page.on("worker", (w) => workers.push(w.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/takelab/");
  await page
    .getByRole("button", { name: "Open the sample project", exact: true })
    .click();
  await expect(page.locator("video")).toHaveCount(9);
  await page
    .getByRole("button", { name: "Inspect frames", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Next source frame A", exact: true }),
  ).toBeEnabled();
  await page.screenshot({ path: path.join(output, "production-subpath.png") });
  expect(workers).toHaveLength(2);
  expect(
    workers.every((url) =>
      url.startsWith(origin + "/takelab/assets/frame.worker-"),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await fs.writeFile(
    path.join(output, "static-host.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        browser: browser.version(),
        build: "dist",
        server: "plain HTTP 200; no Range support",
        frameFlows: 5,
        subpath: "/takelab/",
        workerPaths: workers.map((url) => new URL(url).pathname),
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Production frame workflows and repository-subpath worker loading passed.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
