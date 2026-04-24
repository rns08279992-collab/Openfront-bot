import { toIntentAction, type IntentAction } from "../../shared/protocol/actions";
import {
  ALL_PLAYERS,
  isProtocolId,
  type ClientSendableIntent,
  type Intent,
  type ProtocolId,
} from "../../shared/protocol/intents";

const PINNED_COMMIT = "52033597efb09de6c8d724f6e2784c3c9e8a7511";
const INTENT_ADAPTER_VERSION = 1 as const;

export type IntentAdapterActionType =
  | "spawn_at_tile"
  | "attack_player"
  | "send_boat"
  | "upgrade_structure"
  | "request_alliance"
  | "break_alliance"
  | "target_player"
  | "donate_gold"
  | "donate_troops"
  | "set_embargo"
  | "send_emoji"
  | "delete_unit";

export type IntentAdapterSpecialActionType =
  | "join_game_transport"
  | "rejoin_game_transport"
  | "mark_disconnected"
  | "kick_player"
  | "toggle_pause"
  | "update_game_config";

export type AnyIntentAdapterActionType =
  | IntentAdapterActionType
  | IntentAdapterSpecialActionType;

export interface SpawnAtTileAdapterAction {
  readonly type: "spawn_at_tile";
  readonly tile: number;
}

export interface AttackPlayerAdapterAction {
  readonly type: "attack_player";
  readonly targetPlayerId: ProtocolId | null;
  readonly troops: number | null;
}

export interface SendBoatAdapterAction {
  readonly type: "send_boat";
  readonly destinationTile: number;
  readonly troops: number;
}

export interface RequestAllianceAdapterAction {
  readonly type: "request_alliance";
  readonly recipientPlayerId: ProtocolId;
}

export interface UpgradeStructureAdapterAction {
  readonly type: "upgrade_structure";
  readonly unit: string;
  readonly unitId: number;
}

export interface BreakAllianceAdapterAction {
  readonly type: "break_alliance";
  readonly recipientPlayerId: ProtocolId;
}

export interface TargetPlayerAdapterAction {
  readonly type: "target_player";
  readonly targetPlayerId: ProtocolId;
}

export interface DonateGoldAdapterAction {
  readonly type: "donate_gold";
  readonly recipientPlayerId: ProtocolId;
  readonly amount: number | null;
}

export interface DonateTroopsAdapterAction {
  readonly type: "donate_troops";
  readonly recipientPlayerId: ProtocolId;
  readonly amount: number | null;
}

export interface SetEmbargoAdapterAction {
  readonly type: "set_embargo";
  readonly targetPlayerId: ProtocolId;
  readonly enabled: boolean;
}

export interface SendEmojiAdapterAction {
  readonly type: "send_emoji";
  readonly recipient: ProtocolId | typeof ALL_PLAYERS;
  readonly emoji: number;
}

export interface DeleteUnitAdapterAction {
  readonly type: "delete_unit";
  readonly unitId: number;
}

export type IntentAdapterAction =
  | SpawnAtTileAdapterAction
  | AttackPlayerAdapterAction
  | SendBoatAdapterAction
  | UpgradeStructureAdapterAction
  | RequestAllianceAdapterAction
  | BreakAllianceAdapterAction
  | TargetPlayerAdapterAction
  | DonateGoldAdapterAction
  | DonateTroopsAdapterAction
  | SetEmbargoAdapterAction
  | SendEmojiAdapterAction
  | DeleteUnitAdapterAction;

export type IntentAdapterNestedIntent = ClientSendableIntent;
export type IntentAdapterTransportEnvelope = IntentAction;

export interface IntentAdapterContext {
  readonly phase?: "pre_join" | "lobby" | "active";
  readonly isLobbyCreator?: boolean | null;
}

export interface IntentAdapterCapability {
  readonly actionType: AnyIntentAdapterActionType;
  readonly supported: boolean;
  readonly transportActionType: "intent" | "join" | "rejoin";
  readonly protocolIntentType?: Intent["type"];
  readonly requiresLobbyCreator: boolean;
  readonly allowedPhases: readonly ("pre_join" | "lobby" | "active")[];
  readonly risk: "safe" | "guarded" | "unsupported";
  readonly notes: string;
}

export class IntentAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentAdapterError";
  }
}

export const INTENT_ADAPTER_METADATA = {
  version: INTENT_ADAPTER_VERSION,
  pinnedCommit: PINNED_COMMIT,
} as const;

export const IMPLEMENTED_INTENT_ADAPTER_ACTION_TYPES = [
  "spawn_at_tile",
  "attack_player",
  "send_boat",
  "upgrade_structure",
  "request_alliance",
  "break_alliance",
  "target_player",
  "donate_gold",
  "donate_troops",
  "set_embargo",
  "send_emoji",
  "delete_unit",
] as const satisfies readonly IntentAdapterActionType[];

export const INTENTIONALLY_UNSUPPORTED_ADAPTER_ACTION_TYPES = [
  "join_game_transport",
  "rejoin_game_transport",
  "mark_disconnected",
  "kick_player",
  "toggle_pause",
  "update_game_config",
] as const satisfies readonly IntentAdapterSpecialActionType[];

const CAPABILITIES: Record<AnyIntentAdapterActionType, IntentAdapterCapability> = {
  spawn_at_tile: {
    actionType: "spawn_at_tile",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "spawn",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay spawn intent from the pinned transport.",
  },
  attack_player: {
    actionType: "attack_player",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "attack",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay attack intent with nullable target and troops.",
  },
  send_boat: {
    actionType: "send_boat",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "boat",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay transport-ship intent with explicit destination tile and troop count.",
  },
  upgrade_structure: {
    actionType: "upgrade_structure",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "upgrade_structure",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay upgrade-structure intent. Caller must provide an existing owned unit id and should not guess legality.",
  },
  request_alliance: {
    actionType: "request_alliance",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "allianceRequest",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay alliance request intent.",
  },
  break_alliance: {
    actionType: "break_alliance",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "breakAlliance",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay alliance break intent.",
  },
  target_player: {
    actionType: "target_player",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "targetPlayer",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay player target intent.",
  },
  donate_gold: {
    actionType: "donate_gold",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "donate_gold",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay gold donation intent.",
  },
  donate_troops: {
    actionType: "donate_troops",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "donate_troops",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay troop donation intent.",
  },
  set_embargo: {
    actionType: "set_embargo",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "embargo",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay embargo intent.",
  },
  send_emoji: {
    actionType: "send_emoji",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "emoji",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay emoji intent, including AllPlayers broadcast.",
  },
  delete_unit: {
    actionType: "delete_unit",
    supported: true,
    transportActionType: "intent",
    protocolIntentType: "delete_unit",
    requiresLobbyCreator: false,
    allowedPhases: ["active"],
    risk: "safe",
    notes: "Confirmed gameplay delete-unit intent.",
  },
  join_game_transport: {
    actionType: "join_game_transport",
    supported: false,
    transportActionType: "join",
    requiresLobbyCreator: false,
    allowedPhases: ["pre_join"],
    risk: "unsupported",
    notes: "Join/rejoin are auth-bearing transport actions and are intentionally out of scope for this adapter skeleton.",
  },
  rejoin_game_transport: {
    actionType: "rejoin_game_transport",
    supported: false,
    transportActionType: "rejoin",
    requiresLobbyCreator: false,
    allowedPhases: ["pre_join"],
    risk: "unsupported",
    notes: "Join/rejoin are auth-bearing transport actions and are intentionally out of scope for this adapter skeleton.",
  },
  mark_disconnected: {
    actionType: "mark_disconnected",
    supported: false,
    transportActionType: "intent",
    protocolIntentType: "mark_disconnected",
    requiresLobbyCreator: false,
    allowedPhases: [],
    risk: "unsupported",
    notes: "Server-only intent. GameServer rejects client-sent mark_disconnected.",
  },
  kick_player: {
    actionType: "kick_player",
    supported: false,
    transportActionType: "intent",
    protocolIntentType: "kick_player",
    requiresLobbyCreator: true,
    allowedPhases: ["lobby", "active"],
    risk: "guarded",
    notes: "Pinned source allows this only for the lobby creator. This skeleton does not emit it yet.",
  },
  toggle_pause: {
    actionType: "toggle_pause",
    supported: false,
    transportActionType: "intent",
    protocolIntentType: "toggle_pause",
    requiresLobbyCreator: true,
    allowedPhases: ["active"],
    risk: "guarded",
    notes: "Pinned source allows this only for the lobby creator. This skeleton does not emit it yet.",
  },
  update_game_config: {
    actionType: "update_game_config",
    supported: false,
    transportActionType: "intent",
    protocolIntentType: "update_game_config",
    requiresLobbyCreator: true,
    allowedPhases: ["lobby"],
    risk: "guarded",
    notes: "Pinned source treats this as a lobby-only special case. This skeleton does not emit it yet.",
  },
};

export function getIntentAdapterCapability(
  actionType: AnyIntentAdapterActionType,
): IntentAdapterCapability {
  return CAPABILITIES[actionType];
}

export function isImplementedIntentAdapterActionType(
  value: string,
): value is IntentAdapterActionType {
  return IMPLEMENTED_INTENT_ADAPTER_ACTION_TYPES.includes(
    value as IntentAdapterActionType,
  );
}

export function isIntentionallyUnsupportedIntentAdapterActionType(
  value: string,
): value is IntentAdapterSpecialActionType {
  return INTENTIONALLY_UNSUPPORTED_ADAPTER_ACTION_TYPES.includes(
    value as IntentAdapterSpecialActionType,
  );
}

export function assertIntentAdapterCapability(
  actionType: AnyIntentAdapterActionType,
  context: IntentAdapterContext = {},
): IntentAdapterCapability {
  const capability = getIntentAdapterCapability(actionType);

  if (!capability.supported) {
    throw new IntentAdapterError(
      `IntentAdapter action "${actionType}" is intentionally unsupported: ${capability.notes}`,
    );
  }

  if (
    context.phase !== undefined &&
    !capability.allowedPhases.includes(context.phase)
  ) {
    throw new IntentAdapterError(
      `IntentAdapter action "${actionType}" is not allowed during phase "${context.phase}"`,
    );
  }

  if (capability.requiresLobbyCreator && context.isLobbyCreator !== true) {
    throw new IntentAdapterError(
      `IntentAdapter action "${actionType}" requires lobby-creator capability`,
    );
  }

  return capability;
}

export function adaptIntentAction(
  action: IntentAdapterAction,
  context: IntentAdapterContext = {},
): IntentAdapterTransportEnvelope {
  assertIntentAdapterCapability(action.type, context);
  return toIntentAction(adaptIntent(action, context));
}

export function adaptIntent(
  action: IntentAdapterAction,
  context: IntentAdapterContext = {},
): IntentAdapterNestedIntent {
  assertIntentAdapterCapability(action.type, context);

  switch (action.type) {
    case "spawn_at_tile":
      assertFiniteNumber("tile", action.tile);
      return {
        type: "spawn",
        tile: action.tile,
      };

    case "attack_player":
      if (action.targetPlayerId !== null) {
        assertProtocolId("targetPlayerId", action.targetPlayerId);
      }
      assertNullableNonNegativeNumber("troops", action.troops);
      return {
        type: "attack",
        targetID: action.targetPlayerId,
        troops: action.troops,
      };

    case "send_boat":
      assertFiniteNumber("destinationTile", action.destinationTile);
      assertNonNegativeNumber("troops", action.troops);
      return {
        type: "boat",
        dst: action.destinationTile,
        troops: action.troops,
      };

    case "upgrade_structure":
      assertNonEmptyString("unit", action.unit);
      assertFiniteNumber("unitId", action.unitId);
      return {
        type: "upgrade_structure",
        unit: action.unit,
        unitId: action.unitId,
      };

    case "request_alliance":
      assertProtocolId("recipientPlayerId", action.recipientPlayerId);
      return {
        type: "allianceRequest",
        recipient: action.recipientPlayerId,
      };

    case "break_alliance":
      assertProtocolId("recipientPlayerId", action.recipientPlayerId);
      return {
        type: "breakAlliance",
        recipient: action.recipientPlayerId,
      };

    case "target_player":
      assertProtocolId("targetPlayerId", action.targetPlayerId);
      return {
        type: "targetPlayer",
        target: action.targetPlayerId,
      };

    case "donate_gold":
      assertProtocolId("recipientPlayerId", action.recipientPlayerId);
      assertNullableNonNegativeNumber("amount", action.amount);
      return {
        type: "donate_gold",
        recipient: action.recipientPlayerId,
        gold: action.amount,
      };

    case "donate_troops":
      assertProtocolId("recipientPlayerId", action.recipientPlayerId);
      assertNullableNonNegativeNumber("amount", action.amount);
      return {
        type: "donate_troops",
        recipient: action.recipientPlayerId,
        troops: action.amount,
      };

    case "set_embargo":
      assertProtocolId("targetPlayerId", action.targetPlayerId);
      return {
        type: "embargo",
        targetID: action.targetPlayerId,
        action: action.enabled ? "start" : "stop",
      };

    case "send_emoji":
      if (action.recipient !== ALL_PLAYERS) {
        assertProtocolId("recipient", action.recipient);
      }
      assertNonNegativeInteger("emoji", action.emoji);
      return {
        type: "emoji",
        recipient: action.recipient,
        emoji: action.emoji,
      };

    case "delete_unit":
      assertFiniteNumber("unitId", action.unitId);
      return {
        type: "delete_unit",
        unitId: action.unitId,
      };
  }
}

function assertProtocolId(
  label: string,
  value: string,
): asserts value is ProtocolId {
  if (!isProtocolId(value)) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be an 8-character protocol id, got "${value}"`,
    );
  }
}

function assertFiniteNumber(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be a finite number, got ${String(value)}`,
    );
  }
}

function assertNullableNonNegativeNumber(
  label: string,
  value: number | null,
): void {
  if (value === null) {
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be null or a non-negative finite number, got ${String(value)}`,
    );
  }
}

function assertNonNegativeNumber(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be a non-negative finite number, got ${String(value)}`,
    );
  }
}

function assertNonNegativeInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be a non-negative integer, got ${String(value)}`,
    );
  }
}

function assertNonEmptyString(label: string, value: string): void {
  if (value.trim().length === 0) {
    throw new IntentAdapterError(
      `IntentAdapter expected ${label} to be a non-empty string`,
    );
  }
}
