export const PROTOCOL_ID_REGEX = /^[A-Za-z0-9]{8}$/;

export type ProtocolId = string;
export type GameMapName = string;
export type UnitTypeName = string;
export type QuickChatKey = string;
export type Difficulty = "Easy" | "Medium" | "Hard" | "Impossible";
export type GameType = "Singleplayer" | "Public" | "Private";
export type GameMode = "Free For All" | "Team";
export type RankedType = "1v1";
export type GameMapSize = "Compact" | "Normal";
export type TeamCountMode =
  | number
  | "Duos"
  | "Trios"
  | "Quads"
  | "Humans Vs Nations";

export const ALL_PLAYERS = "AllPlayers" as const;

export interface PublicGameModifiersUpdate {
  readonly isCompact?: boolean;
  readonly isRandomSpawn?: boolean;
  readonly isCrowded?: boolean;
  readonly isHardNations?: boolean;
  readonly startingGold?: number;
  readonly goldMultiplier?: number;
  readonly isAlliancesDisabled?: boolean;
  readonly isPortsDisabled?: boolean;
  readonly isNukesDisabled?: boolean;
  readonly isSAMsDisabled?: boolean;
  readonly isPeaceTime?: boolean;
  readonly isWaterNukes?: boolean;
}

export interface HostCheatsUpdate {
  readonly infiniteGold?: boolean;
  readonly infiniteTroops?: boolean;
  readonly goldMultiplier?: number | null;
  readonly startingGold?: number | null;
}

export interface GameConfigUpdate {
  readonly gameMap?: GameMapName;
  readonly difficulty?: Difficulty;
  readonly donateGold?: boolean;
  readonly donateTroops?: boolean;
  readonly gameType?: GameType;
  readonly gameMode?: GameMode;
  readonly rankedType?: RankedType;
  readonly gameMapSize?: GameMapSize;
  readonly publicGameModifiers?: PublicGameModifiersUpdate;
  readonly nations?: number | "default" | "disabled";
  readonly bots?: number;
  readonly infiniteGold?: boolean;
  readonly infiniteTroops?: boolean;
  readonly instantBuild?: boolean;
  readonly disableNavMesh?: boolean;
  readonly disableAlliances?: boolean | null;
  readonly waterNukes?: boolean | null;
  readonly randomSpawn?: boolean;
  readonly maxPlayers?: number;
  readonly maxTimerValue?: number | null;
  readonly spawnImmunityDuration?: number | null;
  readonly disabledUnits?: readonly UnitTypeName[];
  readonly playerTeams?: TeamCountMode;
  readonly goldMultiplier?: number | null;
  readonly startingGold?: number | null;
  readonly hostCheats?: HostCheatsUpdate;
}

export const INTENT_TYPES = [
  "allianceExtension",
  "allianceReject",
  "allianceRequest",
  "attack",
  "boat",
  "breakAlliance",
  "build_unit",
  "cancel_attack",
  "cancel_boat",
  "delete_unit",
  "donate_gold",
  "donate_troops",
  "embargo",
  "embargo_all",
  "emoji",
  "kick_player",
  "mark_disconnected",
  "move_warship",
  "quick_chat",
  "spawn",
  "targetPlayer",
  "toggle_pause",
  "update_game_config",
  "upgrade_structure",
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export interface AllianceExtensionIntent {
  readonly type: "allianceExtension";
  readonly recipient: ProtocolId;
}

export interface AllianceRejectIntent {
  readonly type: "allianceReject";
  readonly requestor: ProtocolId;
}

export interface AllianceRequestIntent {
  readonly type: "allianceRequest";
  readonly recipient: ProtocolId;
}

export interface AttackIntent {
  readonly type: "attack";
  readonly targetID: ProtocolId | null;
  readonly troops: number | null;
}

export interface BoatIntent {
  readonly type: "boat";
  readonly troops: number;
  readonly dst: number;
}

export interface BreakAllianceIntent {
  readonly type: "breakAlliance";
  readonly recipient: ProtocolId;
}

export interface BuildUnitIntent {
  readonly type: "build_unit";
  readonly unit: UnitTypeName;
  readonly tile: number;
  readonly rocketDirectionUp?: boolean;
}

export interface CancelAttackIntent {
  readonly type: "cancel_attack";
  readonly attackID: string;
}

export interface CancelBoatIntent {
  readonly type: "cancel_boat";
  readonly unitID: number;
}

export interface DeleteUnitIntent {
  readonly type: "delete_unit";
  readonly unitId: number;
}

export interface DonateGoldIntent {
  readonly type: "donate_gold";
  readonly recipient: ProtocolId;
  readonly gold: number | null;
}

export interface DonateTroopsIntent {
  readonly type: "donate_troops";
  readonly recipient: ProtocolId;
  readonly troops: number | null;
}

export interface EmbargoIntent {
  readonly type: "embargo";
  readonly targetID: ProtocolId;
  readonly action: "start" | "stop";
}

export interface EmbargoAllIntent {
  readonly type: "embargo_all";
  readonly action: "start" | "stop";
}

export interface EmojiIntent {
  readonly type: "emoji";
  readonly recipient: ProtocolId | typeof ALL_PLAYERS;
  readonly emoji: number;
}

export interface KickPlayerIntent {
  readonly type: "kick_player";
  readonly target: ProtocolId;
}

export interface MarkDisconnectedIntent {
  readonly type: "mark_disconnected";
  readonly clientID: ProtocolId;
  readonly isDisconnected: boolean;
}

export interface MoveWarshipIntent {
  readonly type: "move_warship";
  readonly unitId: number;
  readonly tile: number;
}

export interface QuickChatIntent {
  readonly type: "quick_chat";
  readonly recipient: ProtocolId;
  readonly quickChatKey: QuickChatKey;
  readonly target?: ProtocolId;
}

export interface SpawnIntent {
  readonly type: "spawn";
  readonly tile: number;
}

export interface TargetPlayerIntent {
  readonly type: "targetPlayer";
  readonly target: ProtocolId;
}

export interface TogglePauseIntent {
  readonly type: "toggle_pause";
  readonly paused: boolean;
}

export interface UpdateGameConfigIntent {
  readonly type: "update_game_config";
  readonly config: GameConfigUpdate;
}

export interface UpgradeStructureIntent {
  readonly type: "upgrade_structure";
  readonly unit: UnitTypeName;
  readonly unitId: number;
}

export type Intent =
  | AllianceExtensionIntent
  | AllianceRejectIntent
  | AllianceRequestIntent
  | AttackIntent
  | BoatIntent
  | BreakAllianceIntent
  | BuildUnitIntent
  | CancelAttackIntent
  | CancelBoatIntent
  | DeleteUnitIntent
  | DonateGoldIntent
  | DonateTroopsIntent
  | EmbargoIntent
  | EmbargoAllIntent
  | EmojiIntent
  | KickPlayerIntent
  | MarkDisconnectedIntent
  | MoveWarshipIntent
  | QuickChatIntent
  | SpawnIntent
  | TargetPlayerIntent
  | TogglePauseIntent
  | UpdateGameConfigIntent
  | UpgradeStructureIntent;

export const SERVER_ONLY_INTENT_TYPES = ["mark_disconnected"] as const;
export type ServerOnlyIntentType = (typeof SERVER_ONLY_INTENT_TYPES)[number];
export type ServerOnlyIntent = Extract<Intent, { type: ServerOnlyIntentType }>;

export const IMMEDIATE_CONTROL_INTENT_TYPES = ["kick_player"] as const;
export type ImmediateControlIntentType =
  (typeof IMMEDIATE_CONTROL_INTENT_TYPES)[number];
export type ImmediateControlIntent = Extract<
  Intent,
  { type: ImmediateControlIntentType }
>;

export const SPECIAL_CASED_INTENT_TYPES = [
  "toggle_pause",
  "update_game_config",
] as const;
export type SpecialCasedIntentType =
  (typeof SPECIAL_CASED_INTENT_TYPES)[number];
export type SpecialCasedIntent = Extract<
  Intent,
  { type: SpecialCasedIntentType }
>;

export const TURN_STORED_INTENT_TYPES = INTENT_TYPES.filter(
  (type) => type !== "kick_player" && type !== "update_game_config",
) as readonly Exclude<IntentType, "kick_player" | "update_game_config">[];
export type TurnStoredIntentType = (typeof TURN_STORED_INTENT_TYPES)[number];
export type TurnStoredIntent = Extract<Intent, { type: TurnStoredIntentType }>;

export const CLIENT_SENDABLE_INTENT_TYPES = INTENT_TYPES.filter(
  (type) => type !== "mark_disconnected",
) as readonly Exclude<IntentType, ServerOnlyIntentType>[];
export type ClientSendableIntentType =
  (typeof CLIENT_SENDABLE_INTENT_TYPES)[number];
export type ClientSendableIntent = Exclude<Intent, ServerOnlyIntent>;

export type StampedClientIntent = ClientSendableIntent & {
  readonly clientID: ProtocolId;
};

// `mark_disconnected` is synthesized by the server and already carries the
// affected client id, so keep it out of the generic client-stamping path.
export type StampedIntent = StampedClientIntent | MarkDisconnectedIntent;

const INTENT_TYPE_SET = new Set<string>(INTENT_TYPES);
const CLIENT_SENDABLE_INTENT_TYPE_SET = new Set<string>(
  CLIENT_SENDABLE_INTENT_TYPES,
);
const SERVER_ONLY_INTENT_TYPE_SET = new Set<string>(SERVER_ONLY_INTENT_TYPES);
const IMMEDIATE_CONTROL_INTENT_TYPE_SET = new Set<string>(
  IMMEDIATE_CONTROL_INTENT_TYPES,
);
const SPECIAL_CASED_INTENT_TYPE_SET = new Set<string>(
  SPECIAL_CASED_INTENT_TYPES,
);
const TURN_STORED_INTENT_TYPE_SET = new Set<string>(TURN_STORED_INTENT_TYPES);

export function isProtocolId(value: string): value is ProtocolId {
  return PROTOCOL_ID_REGEX.test(value);
}

export function isIntentType(value: string): value is IntentType {
  return INTENT_TYPE_SET.has(value);
}

export function isClientSendableIntentType(
  value: string,
): value is ClientSendableIntentType {
  return CLIENT_SENDABLE_INTENT_TYPE_SET.has(value);
}

export function isServerOnlyIntentType(
  value: string,
): value is ServerOnlyIntentType {
  return SERVER_ONLY_INTENT_TYPE_SET.has(value);
}

export function isImmediateControlIntentType(
  value: string,
): value is ImmediateControlIntentType {
  return IMMEDIATE_CONTROL_INTENT_TYPE_SET.has(value);
}

export function isSpecialCasedIntentType(
  value: string,
): value is SpecialCasedIntentType {
  return SPECIAL_CASED_INTENT_TYPE_SET.has(value);
}

export function isTurnStoredIntentType(
  value: string,
): value is TurnStoredIntentType {
  return TURN_STORED_INTENT_TYPE_SET.has(value);
}
