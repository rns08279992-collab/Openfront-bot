import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const cwd = process.cwd();
const args = parseArgs(process.argv.slice(2));
const resultsDir = path.join(cwd, "server", "eval", "results");

fs.mkdirSync(resultsDir, { recursive: true });

let outputPath = resolveOutputPath({
  startedAtIso: new Date().toISOString(),
  profile: args.profile,
  matches: args.matches,
  explicitOutput: args.output,
});

const state = {
  collectorStartedAtIso: new Date().toISOString(),
  startedAtIso: null,
  baseUrl: args.baseUrl,
  profile: args.profile,
  configuredDifficulty: resolveDifficulty(args.profile),
  matchesRequested: args.matches,
  speed: args.speed,
  bots: args.bots,
  pollMs: args.pollMs,
  timeoutMs: args.timeoutMs,
  matches: [],
  summary: null,
  smoke: null,
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    writeCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (!req.url) {
    respondJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "GET" && req.url === "/status") {
    respondJson(res, 200, {
      collectorUrl: currentCollectorUrl,
      outputPath,
    });
    return;
  }

  if (req.method !== "POST") {
    respondJson(res, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readJson(req);
    if (req.url === "/session/start") {
      resetState(body);
      writeState();
      respondJson(res, 200, { ok: true, outputPath });
      return;
    }

    if (req.url === "/match") {
      state.matches.push(normalizeMatchRecord(body, state.matches.length + 1));
      writeState();
      respondJson(res, 200, { ok: true });
      return;
    }

    if (req.url === "/complete") {
      state.summary = normalizeSummary(body.summary, state.matches, state);
      state.smoke = deriveSmokeStatus(state.summary);
      writeState();
      respondJson(res, 200, { ok: true, outputPath });
      return;
    }

    respondJson(res, 404, { error: "Not found" });
  } catch (error) {
    respondJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

let currentCollectorUrl = "";
listenWithFallback(server, args.port, args.portSearchLimit)
  .then((port) => {
    currentCollectorUrl = `http://127.0.0.1:${port}`;
    writeState();

    console.log(`Eval collector listening at ${currentCollectorUrl}`);
    console.log(`Open http://localhost:9000/?openfront_bot_eval=1`);
    console.log(`Results will be written under ${resultsDir}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

function parseArgs(argv) {
  const parsed = {
    profile: "baseline",
    matches: 1,
    speed: 16,
    bots: 48,
    port: 4317,
    portSearchLimit: 10,
    pollMs: 1000,
    timeoutMs: 15 * 60 * 1000,
    baseUrl: process.env.OPENFRONT_EVAL_BASE_URL ?? "http://localhost:9000/",
    output: null,
  };

  for (let index = 0; index < argv.length; index++) {
    const current = argv[index];
    const next = argv[index + 1];

    switch (current) {
      case "--profile":
      case "--difficulty":
        parsed.profile = String(next ?? parsed.profile).toLowerCase();
        index++;
        break;
      case "--matches":
        parsed.matches = parsePositiveInteger(next, parsed.matches);
        index++;
        break;
      case "--speed":
        parsed.speed = parsePositiveInteger(next, parsed.speed);
        index++;
        break;
      case "--bots":
        parsed.bots = parsePositiveInteger(next, parsed.bots);
        index++;
        break;
      case "--port":
        parsed.port = parsePositiveInteger(next, parsed.port);
        index++;
        break;
      case "--port-search-limit":
        parsed.portSearchLimit = parsePositiveInteger(next, parsed.portSearchLimit);
        index++;
        break;
      case "--poll-ms":
        parsed.pollMs = parsePositiveInteger(next, parsed.pollMs);
        index++;
        break;
      case "--timeout-ms":
        parsed.timeoutMs = parsePositiveInteger(next, parsed.timeoutMs);
        index++;
        break;
      case "--base-url":
        parsed.baseUrl = String(next ?? parsed.baseUrl);
        index++;
        break;
      case "--output":
        parsed.output = path.resolve(cwd, String(next));
        index++;
        break;
      default:
        break;
    }
  }

  return parsed;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function resolveDifficulty(profile) {
  switch (profile) {
    case "baseline":
    case "easy":
      return "Easy";
    case "medium":
      return "Medium";
    case "hard":
      return "Hard";
    case "impossible":
      return "Impossible";
    default:
      return "Easy";
  }
}

function resetState(body) {
  const startedAtIso = new Date().toISOString();
  const profile = sanitizeProfile(body.profile ?? args.profile);
  const matchesRequested = parsePositiveInteger(body.matchesRequested, args.matches);

  outputPath = resolveOutputPath({
    startedAtIso,
    profile,
    matches: matchesRequested,
    explicitOutput: args.output,
  });

  Object.assign(state, {
    startedAtIso,
    profile,
    configuredDifficulty: body.configuredDifficulty ?? resolveDifficulty(profile),
    matchesRequested,
    speed: parsePositiveInteger(body.speed, args.speed),
    bots: parsePositiveInteger(body.bots, args.bots),
    pollMs: parsePositiveInteger(body.pollMs, args.pollMs),
    timeoutMs: parsePositiveInteger(body.timeoutMs, args.timeoutMs),
    matches: [],
    summary: null,
    smoke: null,
  });
}

function sanitizeProfile(profile) {
  switch (String(profile).toLowerCase()) {
    case "baseline":
    case "easy":
    case "medium":
    case "hard":
    case "impossible":
      return String(profile).toLowerCase();
    default:
      return "baseline";
  }
}

function resolveOutputPath({ startedAtIso, profile, matches, explicitOutput }) {
  if (explicitOutput) {
    return explicitOutput;
  }

  return path.join(
    resultsDir,
    `${startedAtIso.replaceAll(":", "-")}-${profile}-${matches}.json`,
  );
}

function writeState() {
  fs.writeFileSync(outputPath, JSON.stringify(state, null, 2));
}

function normalizeMatchRecord(input, fallbackMatchIndex) {
  const output = typeof input === "object" && input !== null ? { ...input } : {};
  const outcome = sanitizeOutcome(output.outcome);
  const endReason = typeof output.endReason === "string" ? output.endReason : "unknown";
  const valid = outcome === "win" || outcome === "loss" || outcome === "timeout";

  return {
    ...output,
    matchIndex: parsePositiveInteger(output.matchIndex, fallbackMatchIndex),
    outcome,
    endReason,
    status: valid ? "valid" : outcome === "aborted" ? "aborted" : "invalid",
    valid,
  };
}

function sanitizeOutcome(outcome) {
  switch (String(outcome).toLowerCase()) {
    case "win":
    case "loss":
    case "timeout":
    case "invalid":
    case "aborted":
      return String(outcome).toLowerCase();
    default:
      return "invalid";
  }
}

function normalizeSummary(input, matches, session) {
  const computed = computeSummaryFromMatches(matches, session);
  if (!input || typeof input !== "object") {
    return computed;
  }

  return {
    ...computed,
    profile: sanitizeProfile(input.profile ?? computed.profile),
    matchesRequested: parsePositiveInteger(
      input.matchesRequested,
      computed.matchesRequested,
    ),
    matchesCompleted: parsePositiveInteger(
      input.matchesCompleted,
      computed.matchesCompleted,
    ),
  };
}

function computeSummaryFromMatches(matches, session) {
  const summary = {
    profile: sanitizeProfile(session.profile),
    matchesRequested: parsePositiveInteger(session.matchesRequested, 1),
    matchesCompleted: matches.length,
    validOutcomes: 0,
    invalidOutcomes: 0,
    abortedOutcomes: 0,
    wins: 0,
    losses: 0,
    timeouts: 0,
    invalids: 0,
    aborted: 0,
  };

  for (const match of matches) {
    switch (sanitizeOutcome(match?.outcome)) {
      case "win":
        summary.wins += 1;
        summary.validOutcomes += 1;
        break;
      case "loss":
        summary.losses += 1;
        summary.validOutcomes += 1;
        break;
      case "timeout":
        summary.timeouts += 1;
        summary.validOutcomes += 1;
        break;
      case "aborted":
        summary.aborted += 1;
        summary.abortedOutcomes += 1;
        summary.invalidOutcomes += 1;
        break;
      default:
        summary.invalids += 1;
        summary.invalidOutcomes += 1;
        break;
    }
  }

  return summary;
}

function deriveSmokeStatus(summary) {
  if (!summary) {
    return null;
  }

  const requested = parsePositiveInteger(summary.matchesRequested, 1);
  const completed = parsePositiveInteger(summary.matchesCompleted, 0);
  const shortfall = Math.max(0, requested - completed);
  const passed = shortfall === 0 && summary.invalidOutcomes === 0;

  return {
    requested,
    completed,
    shortfall,
    invalidOutcomes: summary.invalidOutcomes,
    passed,
  };
}

function listenWithFallback(serverInstance, startingPort, attempts) {
  return new Promise((resolve, reject) => {
    const tryListen = (port, remainingAttempts) => {
      const onError = (error) => {
        serverInstance.off("listening", onListening);
        if (error?.code === "EADDRINUSE" && remainingAttempts > 1) {
          tryListen(port + 1, remainingAttempts - 1);
          return;
        }
        reject(error);
      };

      const onListening = () => {
        serverInstance.off("error", onError);
        resolve(port);
      };

      serverInstance.once("error", onError);
      serverInstance.once("listening", onListening);
      serverInstance.listen(port, "127.0.0.1");
    };

    tryListen(startingPort, attempts);
  });
}

function writeCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function respondJson(res, statusCode, payload) {
  writeCorsHeaders(res);
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
  });
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw.length > 0 ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
