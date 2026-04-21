import { decideBaselineAction } from "../../bot/policies/baseline";
import { DebugHUD, type DebugHudSnapshot } from "./DebugHUD";
import {
  adaptIntentAction,
  type IntentAdapterAction,
} from "./IntentAdapter";
import { maybeStartLocalEvalRunner } from "./eval";
import { buildObservation, type Observation } from "./ObservationAdapter";
import { getRuntimeSnapshot, type RuntimeSnapshot } from "./RuntimeHooks";

const DEFAULT_TICK_INTERVAL_MS = 1_000;
const BOOTSTRAP_GLOBAL_KEY = "__OPENFRONT_BOT_BOOTSTRAP__";

export type BootstrapResultCode =
  | "NO_RUNTIME"
  | "NO_OBSERVATION"
  | "NO_ACTION"
  | "ADAPTED_ACTION"
  | "DISPATCHED_ACTION"
  | "ADAPTER_ERROR";

export interface BootstrapTickRecord {
  readonly code: BootstrapResultCode;
  readonly runtime: RuntimeSnapshot;
  readonly observationCompleteness: string;
  readonly chosenAction: IntentAdapterAction | null;
  readonly noActionReason: string | null;
  readonly adapterResult: string;
  readonly lastTickTimeIso: string;
}

export interface BootstrapLoop {
  readonly hud: DebugHUD;
  readonly intervalMs: number;
  tick(): Promise<BootstrapTickRecord>;
  stop(): void;
  latest(): BootstrapTickRecord | null;
}

export function startBootstrapLoop(intervalMs = DEFAULT_TICK_INTERVAL_MS): BootstrapLoop {
  const globalRecord = globalThis as Record<string, unknown>;
  const existing = globalRecord[BOOTSTRAP_GLOBAL_KEY];
  if (isBootstrapLoop(existing)) {
    return existing;
  }

  const hud = new DebugHUD();
  let lastTick: BootstrapTickRecord | null = null;
  let stopped = false;

  const finalizeTick = (record: BootstrapTickRecord): BootstrapTickRecord => {
    lastTick = record;
    hud.update(toHudSnapshot(record));
    globalRecord.__OPENFRONT_BOT_LAST_TICK__ = record;
    logTick(record);
    return record;
  };

  const runTick = async (): Promise<BootstrapTickRecord> => {
    const tickStartedAtIso = new Date().toISOString();
    const runtime = getRuntimeSnapshot();

    if (!runtime.found || !runtime.gameView) {
      return finalizeTick({
        code: "NO_RUNTIME",
        runtime,
        observationCompleteness: "unavailable: runtime not found",
        chosenAction: null,
        noActionReason: runtime.notes.join("; ") || "runtime not found",
        adapterResult: `skipped: ${runtime.notes.join("; ")}`,
        lastTickTimeIso: tickStartedAtIso,
      });
    }

    try {
      logRuntimeFound(runtime);
      const observation = await buildObservation(runtime.gameView);
      const observationAssessment = assessObservationCompleteness(observation);
      logObservationBuilt(observationAssessment.summary);
      if (!observationAssessment.complete) {
        return finalizeTick({
          code: "NO_OBSERVATION",
          runtime,
          observationCompleteness: observationAssessment.summary,
          chosenAction: null,
          noActionReason: observationAssessment.failureReason,
          adapterResult: `skipped: ${observationAssessment.failureReason}`,
          lastTickTimeIso: tickStartedAtIso,
        });
      }

      const chosenAction = decideBaselineAction(observation);
      const noActionReason =
        chosenAction === null ? inferNoActionReason(observation) : null;

      let adapterResult = "skipped: no action selected";
      let code: BootstrapResultCode = "NO_ACTION";
      if (chosenAction !== null) {
        try {
          const envelope = adaptIntentAction(chosenAction, {
            phase: runtime.phase,
            isLobbyCreator: runtime.isLobbyCreator,
          });
          logAdaptedAction(chosenAction, envelope.type, envelope.intent.type);

          if (!runtime.sendAction) {
            adapterResult = `adapted: ${envelope.type}/${envelope.intent.type}; dispatch unavailable`;
            code = "ADAPTED_ACTION";
          } else if (runtime.dispatchState !== "confirmed") {
            adapterResult = `adapted: ${envelope.type}/${envelope.intent.type}; dispatch ${runtime.dispatchState}`;
            code = "ADAPTED_ACTION";
          } else {
            runtime.sendAction(envelope);
            adapterResult = `dispatched: ${envelope.type}/${envelope.intent.type}`;
            code = "DISPATCHED_ACTION";
            logDispatchedAction(chosenAction, envelope.type, envelope.intent.type);
          }
        } catch (error) {
          adapterResult = `error: ${formatError(error)}`;
          code = "ADAPTER_ERROR";
        }
      } else {
        logNoAction(noActionReason);
      }

      return finalizeTick({
        code,
        runtime,
        observationCompleteness: observationAssessment.summary,
        chosenAction,
        noActionReason,
        adapterResult,
        lastTickTimeIso: tickStartedAtIso,
      });
    } catch (error) {
      return finalizeTick({
        code: "NO_OBSERVATION",
        runtime,
        observationCompleteness: "unavailable: observation build failed",
        chosenAction: null,
        noActionReason: `observation build failed: ${formatError(error)}`,
        adapterResult: `error: ${formatError(error)}`,
        lastTickTimeIso: tickStartedAtIso,
      });
    }
  };

  const timer = setInterval(() => {
    if (stopped) {
      return;
    }

    void runTick().catch((error) => {
      const runtime = getRuntimeSnapshot();
      finalizeTick({
        code: "ADAPTER_ERROR",
        runtime,
        observationCompleteness: "unavailable: bootstrap tick failed",
        chosenAction: null,
        noActionReason: `bootstrap tick failed: ${formatError(error)}`,
        adapterResult: `error: ${formatError(error)}`,
        lastTickTimeIso: new Date().toISOString(),
      });
    });
  }, intervalMs);

  const loop: BootstrapLoop = {
    hud,
    intervalMs,
    tick: runTick,
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(timer);
      delete globalRecord[BOOTSTRAP_GLOBAL_KEY];
      hud.dispose();
    },
    latest() {
      return lastTick;
    },
  };

  globalRecord[BOOTSTRAP_GLOBAL_KEY] = loop;
  void runTick();
  return loop;
}

export function getBootstrapLoop(): BootstrapLoop | null {
  const value = (globalThis as Record<string, unknown>)[BOOTSTRAP_GLOBAL_KEY];
  return isBootstrapLoop(value) ? value : null;
}

function assessObservationCompleteness(observation: Observation): {
  complete: boolean;
  summary: string;
  failureReason: string | null;
} {
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  if (!observation.ownPlayer) {
    missingRequired.push("ownPlayer");
  }
  if (!observation.economy) {
    missingRequired.push("economy");
  }
  if (!observation.frontiers) {
    missingRequired.push("frontiers");
  }
  if (!observation.diplomacy) {
    missingRequired.push("diplomacy");
  }
  if (observation.game.session.paused === null) {
    missingOptional.push("paused_state");
  }

  if (missingRequired.length > 0) {
    const optionalNote =
      missingOptional.length > 0
        ? `; optional gaps: ${missingOptional.join(", ")}`
        : "";
    return {
      complete: false,
      summary: `incomplete: missing required ${missingRequired.join(", ")}${optionalNote}`,
      failureReason: `required observation fields missing: ${missingRequired.join(", ")}`,
    };
  }

  if (missingOptional.length > 0) {
    return {
      complete: true,
      summary: `complete_with_gaps: missing optional ${missingOptional.join(", ")}`,
      failureReason: null,
    };
  }

  return {
    complete: true,
    summary: "complete",
    failureReason: null,
  };
}

function inferNoActionReason(observation: Observation): string {
  const player = observation.ownPlayer;
  if (!player) {
    return "own player missing from observation";
  }
  if (!player.isAlive) {
    return "own player is not alive";
  }
  if (!player.hasSpawned) {
    return "legal spawn candidates are not exposed by the observation";
  }
  if (observation.game.session.spawnImmunityActive) {
    return "spawn immunity is active";
  }
  if (observation.game.session.nationSpawnImmunityActive) {
    return "nation spawn immunity is active";
  }
  if (!observation.frontiers) {
    return "frontier data is missing";
  }
  if (!observation.diplomacy) {
    return "diplomacy data is missing";
  }
  if (observation.frontiers.ownBorderTileCount === null) {
    return "border tile count is unavailable";
  }
  if (observation.frontiers.adjacentHostilePlayerIds.length > 0) {
    return "no clearly safe hostile target was exposed";
  }
  if (observation.configSnapshot.resolved.disableAlliances) {
    return "alliances are disabled";
  }
  if (observation.frontiers.adjacentFriendlyPlayerIds.length > 0) {
    return "no trivial alliance candidate was exposed";
  }
  return "no adjacent player interaction was exposed";
}

function toHudSnapshot(record: BootstrapTickRecord): DebugHudSnapshot {
  return {
    runtimeStatus: formatRuntimeStatus(record.runtime),
    observationCompleteness: record.observationCompleteness,
    chosenAction: record.chosenAction ? formatAction(record.chosenAction) : "none",
    noActionReason: record.noActionReason ?? "n/a",
    adapterResult: record.adapterResult,
    lastTickTime: record.lastTickTimeIso,
  };
}

function formatRuntimeStatus(runtime: RuntimeSnapshot): string {
  if (!runtime.found) {
    return `not found${runtime.notes.length > 0 ? ` (${runtime.notes.join("; ")})` : ""}`;
  }

  const details = [
    `found via ${runtime.source ?? "unknown"}`,
    `phase=${runtime.phase}`,
    `dispatch=${runtime.dispatchState}`,
  ];
  if (!runtime.sendAction) {
    details.push("send=missing");
  }
  if (runtime.notes.length > 0) {
    details.push(runtime.notes.join("; "));
  }
  return details.join(", ");
}

function formatAction(action: IntentAdapterAction): string {
  switch (action.type) {
    case "spawn_at_tile":
      return `spawn_at_tile(tile=${action.tile})`;
    case "attack_player":
      return `attack_player(target=${action.targetPlayerId ?? "auto"}, troops=${action.troops ?? "default"})`;
    case "request_alliance":
      return `request_alliance(recipient=${action.recipientPlayerId})`;
    case "break_alliance":
      return `break_alliance(recipient=${action.recipientPlayerId})`;
    case "target_player":
      return `target_player(target=${action.targetPlayerId})`;
    case "donate_gold":
      return `donate_gold(recipient=${action.recipientPlayerId}, amount=${action.amount ?? "default"})`;
    case "donate_troops":
      return `donate_troops(recipient=${action.recipientPlayerId}, amount=${action.amount ?? "default"})`;
    case "set_embargo":
      return `set_embargo(target=${action.targetPlayerId}, enabled=${String(action.enabled)})`;
    case "send_emoji":
      return `send_emoji(recipient=${action.recipient}, emoji=${action.emoji})`;
    case "delete_unit":
      return `delete_unit(unit=${action.unitId})`;
  }
}

function logRuntimeFound(runtime: RuntimeSnapshot): void {
  console.info("[openfront-bot]", "runtime found", {
    runtime: formatRuntimeStatus(runtime),
  });
}

function logObservationBuilt(observationCompleteness: string): void {
  console.info("[openfront-bot]", "observation built", {
    observationCompleteness,
  });
}

function logNoAction(reason: string | null): void {
  console.info("[openfront-bot]", "no action", {
    reason: reason ?? "none",
  });
}

function logAdaptedAction(
  action: IntentAdapterAction,
  envelopeType: string,
  intentType: string,
): void {
  console.info("[openfront-bot]", "adapted action", {
    action: formatAction(action),
    envelopeType,
    intentType,
  });
}

function logDispatchedAction(
  action: IntentAdapterAction,
  envelopeType: string,
  intentType: string,
): void {
  console.info("[openfront-bot]", "dispatched action", {
    action: formatAction(action),
    envelopeType,
    intentType,
  });
}

function logTick(record: BootstrapTickRecord): void {
  const prefix = "[openfront-bot]";
  const payload = {
    code: record.code,
    runtime: formatRuntimeStatus(record.runtime),
    observationCompleteness: record.observationCompleteness,
    chosenAction: record.chosenAction ? formatAction(record.chosenAction) : null,
    noActionReason: record.noActionReason,
    adapterResult: record.adapterResult,
    lastTickTimeIso: record.lastTickTimeIso,
  };

  switch (record.code) {
    case "NO_RUNTIME":
    case "NO_OBSERVATION":
      console.warn(prefix, "tick", payload);
      return;
    case "NO_ACTION":
    case "ADAPTED_ACTION":
      console.info(prefix, "tick", payload);
      return;
    case "DISPATCHED_ACTION":
      console.info(prefix, "tick", payload);
      return;
    case "ADAPTER_ERROR":
      console.error(prefix, "tick", payload);
      return;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isBootstrapLoop(value: unknown): value is BootstrapLoop {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as BootstrapLoop).tick === "function" &&
    typeof (value as BootstrapLoop).stop === "function" &&
    typeof (value as BootstrapLoop).latest === "function"
  );
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  startBootstrapLoop();
  maybeStartLocalEvalRunner();
}
