import { buildObservation, type Observation } from "./ObservationAdapter";
import { getRuntimeSnapshot } from "./RuntimeHooks";

const EVAL_GLOBAL_KEY = "__OPENFRONT_BOT_EVAL__";
const ENABLE_PARAM = "openfront_bot_eval";
const PANEL_ID = "openfront-bot-eval-panel";
const DEFAULT_COLLECTOR_PORT = 4317;
const DEFAULT_COLLECTOR_PORT_ATTEMPTS = 10;
const DEFAULT_BASELINE_BOTS = 48;
const DEFAULT_SAFE_NATION_FALLBACK = 16;
const DEFAULT_POLL_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 15 * 60 * 1_000;
const DEFAULT_SPEED = 16;

type EvalProfileName =
  | "baseline"
  | "easy"
  | "medium"
  | "hard"
  | "impossible";

type EvalOutcome = "win" | "loss" | "timeout" | "invalid";

const RUNTIME_MISSING_ABORT_POLLS = 3;

interface EvalResolution {
  outcome: EvalOutcome;
  reason: string;
}

interface EvalConfig {
  collectorUrl: string;
  profile: EvalProfileName;
  matches: number;
  speed: number;
  bots: number;
  pollMs: number;
  timeoutMs: number;
}

interface EvalMatchResult {
  matchIndex: number;
  gameId: string | null;
  profile: EvalProfileName;
  configuredDifficulty: string;
  startedAtIso: string;
  endedAtIso: string;
  survivalMs: number;
  survivalSeconds: number;
  outcome: EvalOutcome;
  endReason: string;
  win: boolean;
  finalTick: number | null;
  finalLandShare: number | null;
  finalGold: string | null;
  finalTroops: number | null;
}

interface EvalSessionSummary {
  profile: EvalProfileName;
  matchesRequested: number;
  matchesCompleted: number;
  wins: number;
  losses: number;
  timeouts: number;
  invalids: number;
}

interface EvalSinglePlayerModal extends HTMLElement {
  selectedMap?: string;
  selectedDifficulty: string;
  defaultNationCount: number;
  nations: number;
  bots: number;
  compactMap: boolean;
  randomSpawn: boolean;
  loadNationCount?(): Promise<void>;
  open(): void;
  close(): void;
  startGame(): Promise<void>;
}

interface EvalDevHandle {
  setGameSpeed?(speed: number): number;
}

interface EvalRuntimeHandle {
  runner?: {
    stop(force?: boolean): boolean;
  };
}

declare global {
  interface Window {
    showPage?: (pageId: string) => void;
  }
}

interface EvalCollectorStatus {
  collectorUrl: string;
  outputPath: string | null;
}

interface EvalCompleteResponse {
  ok: boolean;
  outputPath?: string;
}

const PROFILE_TO_DIFFICULTY: Record<EvalProfileName, string> = {
  baseline: "Easy",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  impossible: "Impossible",
};

class LocalEvalRunner {
  constructor(
    private readonly config: EvalConfig,
    private readonly onStatus?: (message: string) => void,
  ) {}

  async run(): Promise<string | null> {
    this.onStatus?.("Starting eval session...");
    await this.post("/session/start", {
      profile: this.config.profile,
      configuredDifficulty: this.resolveDifficulty(),
      matchesRequested: this.config.matches,
      speed: this.config.speed,
      bots: this.config.bots,
      pollMs: this.config.pollMs,
      timeoutMs: this.config.timeoutMs,
    });

    const results: EvalMatchResult[] = [];
    for (let matchIndex = 1; matchIndex <= this.config.matches; matchIndex++) {
      this.onStatus?.(`Running match ${matchIndex}/${this.config.matches}...`);
      console.info("[openfront-bot-eval] starting match", {
        matchIndex,
        matches: this.config.matches,
        profile: this.config.profile,
      });
      const result = await this.runSingleMatch(matchIndex);
      results.push(result);
      await this.post("/match", result);
      console.info("[openfront-bot-eval] finished match", result);
    }

    this.onStatus?.("Writing eval results...");
    const response = await this.post<EvalCompleteResponse>("/complete", {
      summary: this.buildSummary(results),
    });
    return response?.outputPath ?? null;
  }

  private async runSingleMatch(matchIndex: number): Promise<EvalMatchResult> {
    await this.ensureNoActiveLobby();
    const singlePlayerModal = await this.openSinglePlayerModal();
    await this.configureSinglePlayerModal(singlePlayerModal);
    await singlePlayerModal.startGame();

    const runtime = await this.waitForRuntime();
    this.setSpeed();

    const startedAtMs = Date.now();
    const startedAtIso = new Date(startedAtMs).toISOString();
    const startedGameId = runtime.gameView.gameID?.() ?? null;
    let latestObservation = await buildObservation(runtime.gameView);
    let missingRuntimePolls = 0;
    let lastObservedTick = latestObservation.game.tick;

    try {
      while (Date.now() - startedAtMs < this.config.timeoutMs) {
        const latestRuntime = getRuntimeSnapshot();
        if (!latestRuntime.found || !latestRuntime.gameView) {
          missingRuntimePolls++;
          if (missingRuntimePolls >= RUNTIME_MISSING_ABORT_POLLS) {
            const resolution: EvalResolution = {
              outcome: "invalid",
              reason: "runtime_missing_before_authoritative_match_end",
            };
            console.info("[openfront-bot-eval] match finished", {
              matchIndex,
              outcome: resolution.outcome,
              reason: resolution.reason,
            });
            return finalizeResult(
              matchIndex,
              this.config.profile,
              this.resolveDifficulty(),
              startedAtIso,
              startedAtMs,
              latestObservation,
              resolution,
            );
          }
          await sleep(this.config.pollMs);
          continue;
        }

        missingRuntimePolls = 0;
        latestObservation = await buildObservation(latestRuntime.gameView);
        const resolution = resolveOutcome(
          latestRuntime.gameView,
          latestObservation,
          startedGameId,
          lastObservedTick,
        );
        lastObservedTick = latestObservation.game.tick;
        if (resolution !== null) {
          console.info("[openfront-bot-eval] match finished", {
            matchIndex,
            outcome: resolution.outcome,
            reason: resolution.reason,
          });
          return finalizeResult(
            matchIndex,
            this.config.profile,
            this.resolveDifficulty(),
            startedAtIso,
            startedAtMs,
            latestObservation,
            resolution,
          );
        }

        await sleep(this.config.pollMs);
      }

      return finalizeResult(
        matchIndex,
        this.config.profile,
        this.resolveDifficulty(),
        startedAtIso,
        startedAtMs,
        latestObservation,
        {
          outcome: "timeout",
          reason: "match_timeout_elapsed",
        },
      );
    } finally {
      await this.resetToEvalReadyMenu();
    }
  }

  private async openSinglePlayerModal(): Promise<EvalSinglePlayerModal> {
    await customElements.whenDefined("single-player-modal");
    const singlePlayerModal = document.querySelector("single-player-modal");
    if (!singlePlayerModal) {
      throw new Error("single-player-modal was not found");
    }

    const typedSinglePlayerModal = singlePlayerModal as EvalSinglePlayerModal;
    typedSinglePlayerModal.open();
    await sleep(100);
    return typedSinglePlayerModal;
  }

  private async configureSinglePlayerModal(
    singlePlayerModal: EvalSinglePlayerModal,
  ): Promise<void> {
    const resolved = await this.resolveSafeSoloConfig(singlePlayerModal);

    singlePlayerModal.selectedDifficulty = this.resolveDifficulty();
    singlePlayerModal.bots = 0;
    singlePlayerModal.nations = resolved.nations;
    singlePlayerModal.compactMap = false;
    singlePlayerModal.randomSpawn = false;

    console.info("[openfront-bot-eval] resolved solo config", {
      map: resolved.map,
      requestedNations: this.config.bots,
      resolvedNations: resolved.nations,
      maxSafeNations: resolved.maxSafeNations,
      configuredDifficulty: this.resolveDifficulty(),
      bots: 0,
      compactMap: false,
      randomSpawn: false,
      nationsMode:
        resolved.nations === resolved.defaultNationCount ? "default" : "explicit",
    });
  }

  private async resolveSafeSoloConfig(singlePlayerModal: EvalSinglePlayerModal): Promise<{
    map: string;
    nations: number;
    maxSafeNations: number;
    defaultNationCount: number;
  }> {
    await singlePlayerModal.loadNationCount?.();

    const defaultNationCount =
      (await waitFor(() => {
        return singlePlayerModal.defaultNationCount > 0
          ? singlePlayerModal.defaultNationCount
          : null;
      }, 5_000).catch(() => null)) ?? 0;

    const maxSafeNations =
      defaultNationCount > 0 ? defaultNationCount : DEFAULT_SAFE_NATION_FALLBACK;
    const nations = Math.min(
      parsePositiveInteger(String(this.config.bots), 1),
      maxSafeNations,
    );

    return {
      map: singlePlayerModal.selectedMap ?? "unknown",
      nations,
      maxSafeNations,
      defaultNationCount,
    };
  }

  private async waitForRuntime(): Promise<ReturnType<typeof getRuntimeSnapshot>> {
    return waitFor(() => {
      const runtime = getRuntimeSnapshot();
      return runtime.found && runtime.gameView ? runtime : null;
    }, 30_000);
  }

  private async ensureNoActiveLobby(): Promise<void> {
    const hostModal = document.querySelector("single-player-modal") as
      | EvalSinglePlayerModal
      | null;
    hostModal?.close();

    await waitFor(
      () => {
        const runtime = getRuntimeSnapshot();
        return runtime.found ? null : true;
      },
      10_000,
    ).catch(() => true);

    await sleep(500);
  }

  private async resetToEvalReadyMenu(): Promise<void> {
    console.info("[openfront-bot-eval] resetting to menu");

    const runtimeHandle = this.getRuntimeHandle();
    runtimeHandle?.runner?.stop?.(true);

    document.body.classList.remove("in-game");
    window.showPage?.("page-play");

    const singlePlayerModal = document.querySelector("single-player-modal") as
      | EvalSinglePlayerModal
      | null;
    singlePlayerModal?.close();

    await waitFor(
      () => {
        const runtime = getRuntimeSnapshot();
        return runtime.found ? null : true;
      },
      10_000,
    ).catch(() => true);

    await sleep(250);
    console.info("[openfront-bot-eval] ready for next match");
  }

  private setSpeed(): void {
    const devHandle = (globalThis as Record<string, unknown>).__OPENFRONT_BOT_DEV__ as
      | EvalDevHandle
      | undefined;
    devHandle?.setGameSpeed?.(this.config.speed);
  }

  private resolveDifficulty(): string {
    return PROFILE_TO_DIFFICULTY[this.config.profile];
  }

  private getRuntimeHandle(): EvalRuntimeHandle | null {
    const globals = globalThis as Record<string, unknown>;
    const handle =
      (globals.__OPENFRONT_BOT_RUNTIME__ as EvalRuntimeHandle | undefined) ??
      (globals.__OPENFRONT_RUNTIME__ as EvalRuntimeHandle | undefined);
    return handle ?? null;
  }

  private buildSummary(results: EvalMatchResult[]): EvalSessionSummary {
    let wins = 0;
    let losses = 0;
    let timeouts = 0;
    let invalids = 0;

    for (const result of results) {
      if (result.outcome === "win") {
        wins++;
      } else if (result.outcome === "loss") {
        losses++;
      } else if (result.outcome === "invalid") {
        invalids++;
      } else {
        timeouts++;
      }
    }

    return {
      profile: this.config.profile,
      matchesRequested: this.config.matches,
      matchesCompleted: results.length,
      wins,
      losses,
      timeouts,
      invalids,
    };
  }

  private async post<T>(path: string, payload: unknown): Promise<T | null> {
    const response = await fetch(`${this.config.collectorUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Collector request failed for ${path}: HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

export function maybeStartLocalEvalRunner(): void {
  const globals = globalThis as Record<string, unknown>;
  if (globals[EVAL_GLOBAL_KEY]) {
    return;
  }

  if (!shouldEnableLocalEval(window.location)) {
    return;
  }

  globals[EVAL_GLOBAL_KEY] = true;
  mountEvalPanel();
}

function shouldEnableLocalEval(location: Location): boolean {
  const params = new URLSearchParams(location.search);
  if (params.get(ENABLE_PARAM) !== "1") {
    return false;
  }

  return isLocalHostname(location.hostname);
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function mountEvalPanel(): void {
  if (document.getElementById(PANEL_ID)) {
    return;
  }

  const container = document.createElement("aside");
  container.id = PANEL_ID;
  container.setAttribute("aria-label", "OpenFront local eval controls");
  Object.assign(container.style, {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: "2147483647",
    width: "240px",
    padding: "12px",
    borderRadius: "10px",
    background: "rgba(15, 23, 42, 0.95)",
    color: "#e2e8f0",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "12px",
    boxShadow: "0 12px 32px rgba(15, 23, 42, 0.35)",
    display: "grid",
    gap: "8px",
  });

  const title = document.createElement("div");
  title.textContent = "Local Eval";
  title.style.fontWeight = "700";
  title.style.fontSize = "13px";
  container.appendChild(title);

  const profileInput = createSelect("Profile", [
    ["baseline", "baseline"],
    ["easy", "easy"],
    ["medium", "medium"],
    ["hard", "hard"],
    ["impossible", "impossible"],
  ]);
  const matchesInput = createNumberInput("Matches", "1");
  const speedInput = createSelect("Speed", [
    ["1", "1x"],
    ["2", "2x"],
    ["4", "4x"],
    ["8", "8x"],
    ["16", "16x"],
    ["32", "32x"],
    ["64", "64x"],
  ]);
  speedInput.control.value = String(DEFAULT_SPEED);
  const botsInput = createNumberInput("Bots", String(DEFAULT_BASELINE_BOTS));

  container.append(
    profileInput.field,
    matchesInput.field,
    speedInput.field,
    botsInput.field,
  );

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.textContent = "Start Eval";
  Object.assign(startButton.style, {
    border: "0",
    borderRadius: "8px",
    padding: "8px 10px",
    background: "#38bdf8",
    color: "#082f49",
    cursor: "pointer",
    font: "inherit",
    fontWeight: "700",
  });

  const status = document.createElement("div");
  status.textContent = "Looking for local eval collector...";
  status.style.lineHeight = "1.4";
  status.style.minHeight = "32px";

  container.append(startButton, status);
  document.body.appendChild(container);

  void refreshCollectorStatus(status);

  startButton.addEventListener("click", () => {
    void startEval();
  });

  async function startEval(): Promise<void> {
    setRunning(true);
    setStatus("Connecting to local eval collector...");

    try {
      const collector = await discoverCollector();
      if (!collector) {
        throw new Error("Collector not found. Run npm run eval:local first.");
      }

      const config: EvalConfig = {
        collectorUrl: collector.collectorUrl,
        profile: sanitizeProfile(profileInput.control.value),
        matches: parsePositiveInteger(matchesInput.control.value, 1),
        speed: parsePositiveInteger(speedInput.control.value, DEFAULT_SPEED),
        bots: parsePositiveInteger(botsInput.control.value, DEFAULT_BASELINE_BOTS),
        pollMs: DEFAULT_POLL_MS,
        timeoutMs: DEFAULT_TIMEOUT_MS,
      };

      const runner = new LocalEvalRunner(config, setStatus);
      const outputPath = await runner.run();
      setStatus(
        outputPath
          ? `Eval complete. Wrote ${outputPath}`
          : "Eval complete. Results written to JSON.",
      );
    } catch (error) {
      setStatus(formatError(error));
      console.error("[openfront-bot-eval] failed", error);
    } finally {
      setRunning(false);
    }
  }

  function setRunning(running: boolean): void {
    startButton.disabled = running;
    profileInput.control.disabled = running;
    matchesInput.control.disabled = running;
    speedInput.control.disabled = running;
    botsInput.control.disabled = running;
    startButton.style.opacity = running ? "0.7" : "1";
    startButton.style.cursor = running ? "wait" : "pointer";
  }

  function setStatus(message: string): void {
    status.textContent = message;
  }
}

async function refreshCollectorStatus(statusNode: HTMLElement): Promise<void> {
  const collector = await discoverCollector();
  statusNode.textContent = collector
    ? "Collector ready. Configure eval and start."
    : "Collector not found. Run npm run eval:local first.";
}

async function discoverCollector(): Promise<EvalCollectorStatus | null> {
  for (
    let port = DEFAULT_COLLECTOR_PORT;
    port < DEFAULT_COLLECTOR_PORT + DEFAULT_COLLECTOR_PORT_ATTEMPTS;
    port++
  ) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      if (!response.ok) {
        continue;
      }

      const body = (await response.json()) as EvalCollectorStatus;
      if (typeof body.collectorUrl === "string") {
        return body;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function createSelect(
  label: string,
  options: Array<[value: string, text: string]>,
): {
  field: HTMLLabelElement;
  control: HTMLSelectElement;
} {
  const field = document.createElement("label");
  field.textContent = label;
  field.style.display = "grid";
  field.style.gap = "4px";

  const control = document.createElement("select");
  applyInputStyles(control);
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    control.appendChild(option);
  }

  field.appendChild(control);
  return { field, control };
}

function createNumberInput(
  label: string,
  initialValue: string,
): {
  field: HTMLLabelElement;
  control: HTMLInputElement;
} {
  const field = document.createElement("label");
  field.textContent = label;
  field.style.display = "grid";
  field.style.gap = "4px";

  const control = document.createElement("input");
  control.type = "number";
  control.min = "1";
  control.step = "1";
  control.value = initialValue;
  applyInputStyles(control);

  field.appendChild(control);
  return { field, control };
}

function applyInputStyles(control: HTMLInputElement | HTMLSelectElement): void {
  Object.assign(control.style, {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid rgba(148, 163, 184, 0.4)",
    borderRadius: "6px",
    padding: "6px 8px",
    background: "rgba(15, 23, 42, 0.7)",
    color: "#f8fafc",
    font: "inherit",
  });
}

function sanitizeProfile(value: string): EvalProfileName {
  const normalized = value.toLowerCase();
  return isEvalProfileName(normalized) ? normalized : "baseline";
}

function isEvalProfileName(value: string): value is EvalProfileName {
  return (
    value === "baseline" ||
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "impossible"
  );
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}

function resolveOutcome(
  gameView: unknown,
  observation: Observation,
  startedGameId: string | null,
  previousObservedTick: number,
): EvalResolution | null {
  const winnerUpdate = findWinnerUpdate(gameView);
  if (winnerUpdate?.winner) {
    return {
      outcome: isWinningWinnerBlock(winnerUpdate.winner, observation) ? "win" : "loss",
      reason: `winner_update:${formatWinnerBlock(winnerUpdate.winner)}`,
    };
  }

  if (
    startedGameId !== null &&
    observation.game.gameID !== null &&
    observation.game.gameID !== startedGameId
  ) {
    return {
      outcome: "invalid",
      reason: `game_id_changed:${startedGameId}->${observation.game.gameID}`,
    };
  }

  if (observation.game.tick < previousObservedTick) {
    return {
      outcome: "invalid",
      reason: `tick_regressed:${previousObservedTick}->${observation.game.tick}`,
    };
  }

  return null;
}

function finalizeResult(
  matchIndex: number,
  profile: EvalProfileName,
  configuredDifficulty: string,
  startedAtIso: string,
  startedAtMs: number,
  observation: Observation,
  resolution: EvalResolution,
): EvalMatchResult {
  const endedAtMs = Date.now();
  const ownPlayer = observation.ownPlayer;
  const finalLandShare =
    ownPlayer && observation.game.map.landTileCount
      ? ownPlayer.tilesOwned / observation.game.map.landTileCount
      : null;

  return {
    matchIndex,
    gameId: observation.game.gameID,
    profile,
    configuredDifficulty,
    startedAtIso,
    endedAtIso: new Date(endedAtMs).toISOString(),
    survivalMs: endedAtMs - startedAtMs,
    survivalSeconds: Number(((endedAtMs - startedAtMs) / 1_000).toFixed(3)),
    outcome: resolution.outcome,
    endReason: resolution.reason,
    win: resolution.outcome === "win",
    finalTick: observation.game.tick ?? null,
    finalLandShare,
    finalGold: ownPlayer?.gold ?? null,
    finalTroops: ownPlayer?.troops ?? null,
  };
}

interface EvalWinnerUpdateLike {
  winner?: readonly string[];
}

function findWinnerUpdate(gameView: unknown): EvalWinnerUpdateLike | null {
  if (typeof gameView !== "object" || gameView === null) {
    return null;
  }

  const updatesSinceLastTick = (
    gameView as { updatesSinceLastTick?: unknown }
  ).updatesSinceLastTick;
  if (typeof updatesSinceLastTick !== "function") {
    return null;
  }

  const updates = updatesSinceLastTick.call(gameView);
  if (!updates || typeof updates !== "object") {
    return null;
  }

  for (const bucket of Object.values(updates as Record<string, unknown>)) {
    if (!Array.isArray(bucket)) {
      continue;
    }
    for (const candidate of bucket) {
      if (isWinnerUpdate(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function isWinnerUpdate(value: unknown): value is EvalWinnerUpdateLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "winner" in value &&
    (value as EvalWinnerUpdateLike).winner !== undefined
  );
}

function isWinningWinnerBlock(
  winner: readonly string[],
  observation: Observation,
): boolean {
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return false;
  }

  if (winner[0] === "player") {
    return ownPlayer.clientID !== null && winner[1] === ownPlayer.clientID;
  }

  if (winner[0] === "team") {
    return ownPlayer.team !== null && winner[1] === ownPlayer.team;
  }

  if (winner[0] === "nation") {
    return ownPlayer.playerType === "NATION" && winner[1] === ownPlayer.name;
  }

  return false;
}

function formatWinnerBlock(winner: readonly string[]): string {
  return winner.join("|");
}

async function waitFor<T>(
  readValue: () => T | null,
  timeoutMs: number,
): Promise<T> {
  const startedAtMs = Date.now();
  while (Date.now() - startedAtMs < timeoutMs) {
    const value = readValue();
    if (value !== null) {
      return value;
    }
    await sleep(100);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
