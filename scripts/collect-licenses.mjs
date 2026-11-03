import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  "react",
  "react-dom",
  "scheduler",
  "lucide-react",
  "fflate",
  "@fix-webm-duration/fix",
  "@fix-webm-duration/parser",
  "tslib",
  "mediabunny",
  "@noble/hashes",
];
const sections = [];
for (const name of packages) {
  const directory = path.join(root, "node_modules", name);
  const metadata = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  let license;
  for (const filename of ["LICENSE", "LICENSE.txt", "LICENSE.md"]) {
    try {
      license = await readFile(path.join(directory, filename), "utf8");
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  if (!license && name.startsWith("@fix-webm-duration/")) {
    // These npm packages omit LICENSE. Vendored from the upstream repository.
    license = await readFile(
      path.join(root, "scripts/licenses/fix-webm-duration.txt"),
      "utf8",
    );
  }
  if (!license) throw new Error(`No license text found for ${name}`);
  sections.push(
    `${name} ${metadata.version}\n${"=".repeat(60)}\n${name === "mediabunny" ? `Source (MPL-2.0): https://github.com/Vanilagy/mediabunny/tree/v${metadata.version}\nTakeLab uses this library unmodified.\n` : ""}\n${license.trim()}\n`,
  );
}
await writeFile(
  path.join(root, "public", "THIRD_PARTY_LICENSES.txt"),
  sections.join("\n\n"),
);
await writeFile(
  path.join(root, "public", "LICENSE.txt"),
  await readFile(path.join(root, "LICENSE")),
);
console.log(`Collected ${packages.length} runtime license texts.`);
