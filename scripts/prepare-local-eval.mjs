import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const upstreamMainPath = path.join(
  repoRoot,
  ".tmp",
  "OpenFrontIO-upstream",
  "src",
  "client",
  "Main.ts",
);
const insertedImportLine =
  'import "../../../../browser/page-adapter/bootstrap.ts"; // openfront-local-eval';

if (!fs.existsSync(upstreamMainPath)) {
  console.error(
    `Missing upstream checkout file: ${upstreamMainPath}\n` +
      "Expected .tmp/OpenFrontIO-upstream to exist before preparing local eval.",
  );
  process.exit(1);
}

const original = fs.readFileSync(upstreamMainPath, "utf8");

if (original.includes(insertedImportLine)) {
  console.log(
    "No changes: .tmp/OpenFrontIO-upstream/src/client/Main.ts already contains local eval bootstrap import.",
  );
  process.exit(0);
}

const importBlockMatch = original.match(/^(?:import[\s\S]*?;\r?\n)+/);

if (!importBlockMatch) {
  console.error(
    `Could not find top-level import block in ${upstreamMainPath}. No changes made.`,
  );
  process.exit(1);
}

const updated =
  original.slice(0, importBlockMatch[0].length) +
  `${insertedImportLine}\n` +
  original.slice(importBlockMatch[0].length);

fs.writeFileSync(upstreamMainPath, updated);

console.log(
  "Updated .tmp/OpenFrontIO-upstream/src/client/Main.ts: inserted local eval bootstrap import.",
);
console.log(`Inserted line: ${insertedImportLine}`);
