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
const upstreamClientGameRunnerPath = path.join(
  repoRoot,
  ".tmp",
  "OpenFrontIO-upstream",
  "src",
  "client",
  "ClientGameRunner.ts",
);
const insertedMainImportLine =
  'import "../../../../browser/page-adapter/bootstrap.ts"; // openfront-local-eval';
const insertedRuntimeImportLine =
  'import { installRuntimeHooks } from "../../../../browser/page-adapter/RuntimeHooks.ts"; // openfront-local-eval-runtime';
const runtimeHookMarker = "// openfront-local-eval-runtime";
const runtimeHookLines = [
  { indent: "", text: "installRuntimeHooks({" },
  { indent: "  ", text: 'sourceName: "ClientGameRunner",' },
  { indent: "  ", text: "runner: r," },
  { indent: "  ", text: "gameView: (r as any).gameView," },
  { indent: "  ", text: "transport: (r as any).transport," },
  {
    indent: "  ",
    text: "sendAction: (action) => (r as any).transport.sendMsg(action),",
  },
  { indent: "", text: `}); ${runtimeHookMarker}` },
  {
    indent: "",
    text: `(globalThis as any).__OPENFRONT_CLIENT_GAME_RUNNER__ = r; ${runtimeHookMarker}`,
  },
];

for (const requiredPath of [upstreamMainPath, upstreamClientGameRunnerPath]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(
      `Missing upstream checkout file: ${requiredPath}\n` +
        "Expected .tmp/OpenFrontIO-upstream to exist before preparing local eval.",
    );
    process.exit(1);
  }
}

function insertIntoImportBlock(filePath, source, insertedLine) {
  if (source.includes(insertedLine)) {
    return { updated: source, changed: false };
  }

  const importBlockMatch = source.match(/^(?:import[\s\S]*?;\r?\n)+/);

  if (!importBlockMatch) {
    console.error(
      `Could not find top-level import block in ${filePath}. No changes made.`,
    );
    process.exit(1);
  }

  return {
    updated:
      source.slice(0, importBlockMatch[0].length) +
      `${insertedLine}\n` +
      source.slice(importBlockMatch[0].length),
    changed: true,
  };
}

function insertRuntimeHook(source) {
  const anchor = /(^([ \t]*)currentGameRunner = r;\r?\n)([\s\S]*?)(^\2r\.start\(\);)/m;
  const anchorMatch = source.match(anchor);

  if (!anchorMatch) {
    console.error(
      `Could not find runner start hook anchor in ${upstreamClientGameRunnerPath}. No changes made.`,
    );
    process.exit(1);
  }

  const indent = anchorMatch[2];
  const insertedRuntimeHookBlock = runtimeHookLines
    .map(({ indent: relativeIndent, text }) => `${indent}${relativeIndent}${text}`)
    .join("\n");
  const currentBetween = anchorMatch[3];

  if (currentBetween === `${insertedRuntimeHookBlock}\n`) {
    return { updated: source, changed: false };
  }

  const existingMarkedBlock = new RegExp(
    `^[ \\t]*installRuntimeHooks\\([\\s\\S]*?^[ \\t]*\\(globalThis as any\\)\\.__OPENFRONT_CLIENT_GAME_RUNNER__ = r; ${runtimeHookMarker}\\r?\\n?`,
    "gm",
  );
  const normalizedBetween = currentBetween.replace(existingMarkedBlock, "");

  return {
    updated: source.replace(
      anchor,
      `$1${normalizedBetween}${insertedRuntimeHookBlock}\n$4`,
    ),
    changed:
      currentBetween !== `${normalizedBetween}${insertedRuntimeHookBlock}\n`,
  };
}

const mainOriginal = fs.readFileSync(upstreamMainPath, "utf8");
const mainImportResult = insertIntoImportBlock(
  upstreamMainPath,
  mainOriginal,
  insertedMainImportLine,
);

if (mainImportResult.changed) {
  fs.writeFileSync(upstreamMainPath, mainImportResult.updated);
}

const clientGameRunnerOriginal = fs.readFileSync(upstreamClientGameRunnerPath, "utf8");
const runtimeImportResult = insertIntoImportBlock(
  upstreamClientGameRunnerPath,
  clientGameRunnerOriginal,
  insertedRuntimeImportLine,
);
const runtimeHookResult = insertRuntimeHook(runtimeImportResult.updated);

if (runtimeImportResult.changed || runtimeHookResult.changed) {
  fs.writeFileSync(upstreamClientGameRunnerPath, runtimeHookResult.updated);
}

if (!mainImportResult.changed && !runtimeImportResult.changed && !runtimeHookResult.changed) {
  console.log(
    "No changes: upstream local eval bootstrap import and runtime hook are already installed.",
  );
  process.exit(0);
}

if (mainImportResult.changed) {
  console.log(
    "Updated .tmp/OpenFrontIO-upstream/src/client/Main.ts: inserted local eval bootstrap import.",
  );
  console.log(`Inserted line: ${insertedMainImportLine}`);
}

if (runtimeImportResult.changed) {
  console.log(
    "Updated .tmp/OpenFrontIO-upstream/src/client/ClientGameRunner.ts: inserted runtime hook import.",
  );
  console.log(`Inserted line: ${insertedRuntimeImportLine}`);
}

if (runtimeHookResult.changed) {
  console.log(
    "Updated .tmp/OpenFrontIO-upstream/src/client/ClientGameRunner.ts: inserted runtime hook block before r.start().",
  );
}
