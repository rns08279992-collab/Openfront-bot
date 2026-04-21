import type {
  ClientSendableIntent,
  ProtocolId,
} from "./intents";

export type Username = string;
export type ClanTag = string | null;

// The pinned source accepts either a JWT or a persistent UUID token here.
export type PlayToken = string;

export interface PlayerCosmeticRefs {
  readonly flag?: string;
  readonly color?: string;
  readonly patternName?: string;
  readonly patternColorPaletteName?: string;
}

export type Winner =
  | readonly ["player", ProtocolId, ...ProtocolId[]]
  | readonly ["team", string, ...ProtocolId[]]
  | readonly ["nation", string, ...ProtocolId[]]
  | undefined;

// Stats payloads are confirmed to be keyed by protocol id, but the detailed
// player stats shape is outside this transport-layer extraction.
export type AllPlayersStats = Readonly<Record<ProtocolId, unknown>>;

export const LOG_SEVERITIES = [
  "DEBUG",
  "INFO",
  "WARN",
  "ERROR",
  "FATAL",
] as const;
export type LogSeverity = (typeof LOG_SEVERITIES)[number];

export const CLIENT_ACTION_TYPES = [
  "join",
  "rejoin",
  "intent",
  "ping",
  "hash",
  "winner",
  "log",
] as const;
export type ClientActionType = (typeof CLIENT_ACTION_TYPES)[number];

export const PRE_JOIN_ACTION_TYPES = ["join", "rejoin", "ping"] as const;
export type PreJoinActionType = (typeof PRE_JOIN_ACTION_TYPES)[number];

export const AUTH_BEARING_ACTION_TYPES = ["join", "rejoin"] as const;
export type AuthBearingActionType =
  (typeof AUTH_BEARING_ACTION_TYPES)[number];

export interface JoinAction {
  readonly type: "join";
  readonly token: PlayToken;
  readonly gameID: ProtocolId;
  readonly username: Username;
  readonly clanTag: ClanTag;
  readonly cosmetics?: PlayerCosmeticRefs;
  readonly turnstileToken: string | null;
}

export interface RejoinAction {
  readonly type: "rejoin";
  readonly gameID: ProtocolId;
  readonly lastTurn: number;
  readonly token: PlayToken;
}

export interface IntentAction {
  readonly type: "intent";
  // `mark_disconnected` is intentionally excluded here because clients should
  // not send it even though the pinned schema still includes it internally.
  readonly intent: ClientSendableIntent;
}

export interface PingAction {
  readonly type: "ping";
}

export interface HashAction {
  readonly type: "hash";
  readonly hash: number;
  readonly turnNumber: number;
}

export interface WinnerAction {
  readonly type: "winner";
  readonly winner: Winner;
  readonly allPlayersStats: AllPlayersStats;
}

export interface LogAction {
  readonly type: "log";
  readonly severity: LogSeverity;
  readonly log: ProtocolId;
}

export type ClientAction =
  | JoinAction
  | RejoinAction
  | IntentAction
  | PingAction
  | HashAction
  | WinnerAction
  | LogAction;

export type PreJoinAction = Extract<ClientAction, { type: PreJoinActionType }>;
export type AuthBearingAction = Extract<
  ClientAction,
  { type: AuthBearingActionType }
>;

const CLIENT_ACTION_TYPE_SET = new Set<string>(CLIENT_ACTION_TYPES);
const PRE_JOIN_ACTION_TYPE_SET = new Set<string>(PRE_JOIN_ACTION_TYPES);
const AUTH_BEARING_ACTION_TYPE_SET = new Set<string>(
  AUTH_BEARING_ACTION_TYPES,
);

export function isClientActionType(value: string): value is ClientActionType {
  return CLIENT_ACTION_TYPE_SET.has(value);
}

export function isPreJoinActionType(value: string): value is PreJoinActionType {
  return PRE_JOIN_ACTION_TYPE_SET.has(value);
}

export function isAuthBearingActionType(
  value: string,
): value is AuthBearingActionType {
  return AUTH_BEARING_ACTION_TYPE_SET.has(value);
}

export function toIntentAction(intent: ClientSendableIntent): IntentAction {
  return {
    type: "intent",
    intent,
  };
}
