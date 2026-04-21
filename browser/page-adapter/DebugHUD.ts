import { buildObservation } from "./ObservationAdapter";

export interface DebugHudSnapshot {
  readonly runtimeStatus: string;
  readonly observationCompleteness: string;
  readonly chosenAction: string;
  readonly noActionReason: string;
  readonly adapterResult: string;
  readonly lastTickTime: string;
  readonly spawnActionable?: boolean | null;
  readonly spawnBlockedReason?: string | null;
  readonly dispatchedStatus?: string | null;
}

interface LiveTickRecordLike {
  readonly code?: string;
  readonly runtime?: {
    readonly gameView?: unknown;
  } | null;
  readonly observationCompleteness?: string;
  readonly chosenAction?: unknown;
  readonly noActionReason?: string | null;
  readonly adapterResult?: string;
  readonly lastTickTimeIso?: string;
}

interface ResolvedHudState {
  readonly runtimeStatus: string;
  readonly observationCompleteness: string;
  readonly spawnActionable: string;
  readonly spawnBlockedReason: string;
  readonly chosenAction: string;
  readonly noActionReason: string;
  readonly dispatchedStatus: string;
  readonly lastTickTime: string;
}

const HUD_ELEMENT_ID = "openfront-bot-debug-hud";
const LAST_TICK_GLOBAL_KEY = "__OPENFRONT_BOT_LAST_TICK__";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export class DebugHUD {
  private readonly container: HTMLDivElement;
  private readonly pre: HTMLPreElement;
  private readonly enabled: boolean;
  private lastSnapshot: DebugHudSnapshot | null = null;
  private derivedSpawnActionable: boolean | null = null;
  private derivedSpawnBlockedReason: string | null = null;
  private lastObservedTickIso: string | null = null;
  private observationRefreshInFlight = false;

  constructor(documentRef: Document = document) {
    const existing = documentRef.getElementById(HUD_ELEMENT_ID);
    this.enabled = isDevLocalhost(documentRef);

    if (existing instanceof HTMLDivElement) {
      this.container = existing;
      this.pre =
        (existing.querySelector("pre") as HTMLPreElement | null) ??
        this.createPre(existing);
      return;
    }

    this.container = documentRef.createElement("div");
    this.container.id = HUD_ELEMENT_ID;
    this.container.setAttribute("data-openfront-bot", "debug-hud");
    Object.assign(this.container.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483647",
      maxWidth: "360px",
      padding: "8px 10px",
      borderRadius: "6px",
      background: "rgba(10, 14, 20, 0.88)",
      color: "#e7edf6",
      border: "1px solid rgba(231, 237, 246, 0.14)",
      boxShadow: "0 6px 18px rgba(0, 0, 0, 0.24)",
      pointerEvents: "none",
      fontFamily:
        "ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace",
      fontSize: "12px",
      lineHeight: "1.35",
      whiteSpace: "pre-wrap",
      display: this.enabled ? "block" : "none",
    } satisfies Partial<CSSStyleDeclaration>);
    this.pre = this.createPre(this.container);

    if (documentRef.body) {
      documentRef.body.appendChild(this.container);
    } else {
      documentRef.addEventListener(
        "DOMContentLoaded",
        () => {
          documentRef.body?.appendChild(this.container);
        },
        { once: true },
      );
    }
  }

  update(snapshot: DebugHudSnapshot): void {
    this.lastSnapshot = snapshot;
    if (!this.enabled) {
      return;
    }

    this.render();
    void this.refreshFromLiveTick();
  }

  dispose(): void {
    this.container.remove();
  }

  private createPre(container: HTMLElement): HTMLPreElement {
    const pre = container.ownerDocument.createElement("pre");
    Object.assign(pre.style, {
      margin: "0",
      whiteSpace: "pre-wrap",
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(pre);
    return pre;
  }

  private render(): void {
    if (!this.lastSnapshot || !this.enabled) {
      return;
    }

    const state = this.resolveHudState(this.lastSnapshot);
    this.pre.textContent = [
      `runtime: ${state.runtimeStatus}`,
      `observation: ${state.observationCompleteness}`,
      `spawn.actionable: ${state.spawnActionable}`,
      `spawn.blockedReason: ${state.spawnBlockedReason}`,
      `last action: ${state.chosenAction}`,
      `noActionReason: ${state.noActionReason}`,
      `adapter/dispatched: ${state.dispatchedStatus}`,
      `last tick: ${state.lastTickTime}`,
    ].join("\n");
  }

  private resolveHudState(snapshot: DebugHudSnapshot): ResolvedHudState {
    const liveTick = readLiveTickRecord();
    return {
      runtimeStatus: snapshot.runtimeStatus,
      observationCompleteness:
        snapshot.observationCompleteness ??
        liveTick?.observationCompleteness ??
        "n/a",
      spawnActionable: formatBooleanLike(
        snapshot.spawnActionable ?? this.derivedSpawnActionable,
      ),
      spawnBlockedReason:
        snapshot.spawnBlockedReason ??
        this.derivedSpawnBlockedReason ??
        "n/a",
      chosenAction: snapshot.chosenAction,
      noActionReason: snapshot.noActionReason,
      dispatchedStatus:
        snapshot.dispatchedStatus ??
        snapshot.adapterResult ??
        liveTick?.adapterResult ??
        "n/a",
      lastTickTime: snapshot.lastTickTime,
    };
  }

  private async refreshFromLiveTick(): Promise<void> {
    const liveTick = readLiveTickRecord();
    const tickIso = liveTick?.lastTickTimeIso ?? null;
    if (!liveTick || !tickIso || this.lastObservedTickIso === tickIso) {
      return;
    }
    if (this.observationRefreshInFlight) {
      return;
    }

    const gameView = liveTick.runtime?.gameView;
    if (!gameView) {
      this.lastObservedTickIso = tickIso;
      this.derivedSpawnActionable = null;
      this.derivedSpawnBlockedReason = null;
      this.render();
      return;
    }

    this.observationRefreshInFlight = true;
    try {
      const observation = await buildObservation(gameView);
      this.lastObservedTickIso = tickIso;
      this.derivedSpawnActionable = observation.spawn.actionable;
      this.derivedSpawnBlockedReason = observation.spawn.blockedReason;
      this.render();
    } catch {
      this.lastObservedTickIso = tickIso;
      this.derivedSpawnActionable = null;
      this.derivedSpawnBlockedReason = "unavailable: observation refresh failed";
      this.render();
    } finally {
      this.observationRefreshInFlight = false;
    }
  }
}

function readLiveTickRecord(): LiveTickRecordLike | null {
  const value = (globalThis as Record<string, unknown>)[LAST_TICK_GLOBAL_KEY];
  return isRecord(value) ? (value as LiveTickRecordLike) : null;
}

function isDevLocalhost(documentRef: Document): boolean {
  const location = documentRef.defaultView?.location;
  if (!location) {
    return false;
  }
  return LOCAL_HOSTS.has(location.hostname);
}

function formatBooleanLike(value: boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  return value ? "true" : "false";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
