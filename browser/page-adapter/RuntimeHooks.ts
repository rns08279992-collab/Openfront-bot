import type { IntentAction } from "../../shared/protocol/actions";
import type { ObservationGameLike } from "./ObservationAdapter";

const INSTALLED_RUNTIME_KEY = "__OPENFRONT_BOT_RUNTIME__";
const RUNTIME_CANDIDATES = [
  {
    key: "__OPENFRONT_BOT_RUNTIME__",
    senderTrust: "confirmed",
  },
  {
    key: "__OPENFRONT_RUNTIME__",
    senderTrust: "confirmed",
  },
  {
    key: "__OPENFRONT_CLIENT_GAME_RUNNER__",
    senderTrust: "unconfirmed",
  },
  {
    key: "currentGameRunner",
    senderTrust: "unconfirmed",
  },
] as const;

export type RuntimeSnapshotCode =
  | "NO_RUNTIME"
  | "NO_GAME_VIEW"
  | "RUNTIME_READY";

export type RuntimeDispatchState =
  | "unavailable"
  | "unconfirmed"
  | "confirmed";

export interface RuntimeHookInstall {
  readonly gameView?: unknown;
  readonly transport?: unknown;
  readonly runner?: unknown;
  readonly sendAction?: (action: IntentAction) => unknown;
  readonly sourceName?: string;
}

export interface RuntimeSnapshot {
  readonly code: RuntimeSnapshotCode;
  readonly found: boolean;
  readonly source: string | null;
  readonly gameView: ObservationGameLike | null;
  readonly sendAction: ((action: IntentAction) => unknown) | null;
  readonly dispatchState: RuntimeDispatchState;
  readonly phase: "pre_join" | "lobby" | "active";
  readonly isLobbyCreator: boolean | null;
  readonly paused: boolean | null;
  readonly notes: string[];
}

export function installRuntimeHooks(handle: RuntimeHookInstall): void {
  (globalThis as Record<string, unknown>)[INSTALLED_RUNTIME_KEY] = handle;
}

export function clearInstalledRuntimeHooks(): void {
  delete (globalThis as Record<string, unknown>)[INSTALLED_RUNTIME_KEY];
}

export function getRuntimeSnapshot(root: unknown = globalThis): RuntimeSnapshot {
  const runtimeRoot = asRecord(root);
  if (!runtimeRoot) {
    return missingRuntimeSnapshot("global object unavailable");
  }

  for (const candidateConfig of RUNTIME_CANDIDATES) {
    const candidate = runtimeRoot[candidateConfig.key];
    const snapshot = normalizeRuntimeCandidate(
      candidate,
      candidateConfig.key,
      candidateConfig.senderTrust,
    );
    if (snapshot) {
      return snapshot;
    }
  }

  return missingRuntimeSnapshot(
    `no supported runtime candidate found on globals: ${RUNTIME_CANDIDATES.map((candidate) => candidate.key).join(", ")}`,
  );
}

function normalizeRuntimeCandidate(
  candidate: unknown,
  fallbackSource: string,
  senderTrust: RuntimeDispatchState,
): RuntimeSnapshot | null {
  if (candidate === undefined || candidate === null) {
    return null;
  }

  if (isObservationGameLike(candidate)) {
    return createRuntimeSnapshot({
      source: fallbackSource,
      gameView: candidate,
      transport: null,
      sender: null,
      dispatchState: "unavailable",
      notes: ["using direct GameView-like runtime candidate"],
    });
  }

  const record = asRecord(candidate);
  if (!record) {
    return createRuntimeSnapshot({
      source: fallbackSource,
      gameView: null,
      transport: null,
      sender: null,
      dispatchState: "unavailable",
      notes: ["candidate exists but is not an object"],
    });
  }

  const source =
    typeof record.sourceName === "string" && record.sourceName.length > 0
      ? record.sourceName
      : fallbackSource;

  const runner = asRecord(record.runner);
  const gameViewCandidate = record.gameView ?? runner?.gameView ?? record.game ?? candidate;
  const transportCandidate = record.transport ?? runner?.transport;
  const senderResolution = resolveSendAction(
    record,
    transportCandidate,
    runner,
    senderTrust,
  );

  if (isObservationGameLike(gameViewCandidate)) {
    const notes: string[] = [];
    if (!senderResolution.sendAction) {
      notes.push("runtime found but no supported transport sender is available");
    }
    notes.push(...senderResolution.notes);

    return createRuntimeSnapshot({
      source,
      gameView: gameViewCandidate,
      transport: transportCandidate,
      sender: senderResolution.sendAction,
      dispatchState: senderResolution.dispatchState,
      notes,
    });
  }

  const notes = ["candidate exists but no GameView-like object was found"];
  if (!senderResolution.sendAction && transportCandidate) {
    notes.push("transport exists but GameView is missing");
  }
  notes.push(...senderResolution.notes);

  return createRuntimeSnapshot({
    source,
    gameView: null,
    transport: transportCandidate,
    sender: senderResolution.sendAction,
    dispatchState: senderResolution.dispatchState,
    notes,
  });
}

function createRuntimeSnapshot(args: {
  source: string;
  gameView: ObservationGameLike | null;
  transport: unknown;
  sender: ((action: IntentAction) => unknown) | null;
  dispatchState: RuntimeDispatchState;
  notes: string[];
}): RuntimeSnapshot {
  const myPlayer = args.gameView?.myPlayer?.() ?? null;
  return {
    code: args.gameView ? "RUNTIME_READY" : "NO_GAME_VIEW",
    found: args.gameView !== null,
    source: args.source,
    gameView: args.gameView,
    sendAction: args.sender,
    dispatchState: args.dispatchState,
    phase: args.gameView ? "active" : args.transport ? "lobby" : "pre_join",
    isLobbyCreator:
      myPlayer && typeof myPlayer.isLobbyCreator === "function"
        ? myPlayer.isLobbyCreator()
        : null,
    paused: null,
    notes: args.notes,
  };
}

function missingRuntimeSnapshot(reason: string): RuntimeSnapshot {
  return {
    code: "NO_RUNTIME",
    found: false,
    source: null,
    gameView: null,
    sendAction: null,
    dispatchState: "unavailable",
    phase: "pre_join",
    isLobbyCreator: null,
    paused: null,
    notes: [reason],
  };
}

function resolveSendAction(
  candidate: Record<string, unknown>,
  transportCandidate: unknown,
  runnerCandidate: Record<string, unknown> | null,
  defaultTrust: RuntimeDispatchState,
): {
  sendAction: ((action: IntentAction) => unknown) | null;
  dispatchState: RuntimeDispatchState;
  notes: string[];
} {
  const directSendAction = candidate.sendAction;
  if (typeof directSendAction === "function") {
    return {
      sendAction: (action) => directSendAction(action),
      dispatchState: "confirmed",
      notes: [],
    };
  }

  if (defaultTrust !== "confirmed") {
    return {
      sendAction: null,
      dispatchState: transportCandidate ? "unconfirmed" : "unavailable",
      notes: transportCandidate
        ? [
            "transport candidate found, but dispatch is intentionally disabled until the runtime is installed through an explicit hook",
          ]
        : [],
    };
  }

  const senders = [transportCandidate, runnerCandidate?.transport, candidate.transport];
  for (const senderSource of senders) {
    const sender = createTransportSender(senderSource);
    if (sender) {
      return {
        sendAction: sender,
        dispatchState: "confirmed",
        notes: [],
      };
    }
  }

  return {
    sendAction: null,
    dispatchState: "unavailable",
    notes: [],
  };
}

function createTransportSender(
  transportCandidate: unknown,
): ((action: IntentAction) => unknown) | null {
  const transport = asRecord(transportCandidate);
  if (!transport) {
    return null;
  }

  const sendMsg = transport.sendMsg;
  if (typeof sendMsg === "function") {
    return (action) => sendMsg.call(transportCandidate, action);
  }

  const sendIntent = transport.sendIntent;
  if (typeof sendIntent === "function") {
    return (action) => {
      if (action.type !== "intent") {
        throw new Error(
          `RuntimeHooks expected an intent transport envelope, got ${action.type}`,
        );
      }
      return sendIntent.call(transportCandidate, action.intent);
    };
  }

  return null;
}

function isObservationGameLike(value: unknown): value is ObservationGameLike {
  const record = asRecord(value);
  return Boolean(
    record &&
      typeof record.config === "function" &&
      typeof record.players === "function" &&
      typeof record.units === "function" &&
      typeof record.width === "function" &&
      typeof record.height === "function" &&
      typeof record.x === "function" &&
      typeof record.y === "function" &&
      typeof record.ticks === "function" &&
      typeof record.inSpawnPhase === "function",
  );
}

function asRecord(value: unknown): Record<string, any> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, any>)
    : null;
}
