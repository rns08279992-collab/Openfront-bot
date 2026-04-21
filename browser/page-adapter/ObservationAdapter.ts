import type {
  Difficulty,
  GameMapName,
  GameMapSize,
  GameMode,
  GameType,
  HostCheatsUpdate,
  ProtocolId,
  PublicGameModifiersUpdate,
  RankedType,
  TeamCountMode,
  UnitTypeName,
} from "../../shared/protocol/intents";

const PINNED_COMMIT = "52033597efb09de6c8d724f6e2784c3c9e8a7511";
const OBSERVATION_ADAPTER_VERSION = 3 as const;

type GoldLike = bigint | number | string;
type TileRefLike = number;
type MaybePromise<T> = T | Promise<T>;
type ObservationPlayerType = "BOT" | "HUMAN" | "NATION" | string;

export interface ObservationTilePosition {
  tileRef: TileRefLike;
  x: number;
  y: number;
}

export interface ObservationPublicGameModifiersSnapshot {
  isCompact: boolean | null;
  isRandomSpawn: boolean | null;
  isCrowded: boolean | null;
  isHardNations: boolean | null;
  startingGold: number | null;
  goldMultiplier: number | null;
  isAlliancesDisabled: boolean | null;
  isPortsDisabled: boolean | null;
  isNukesDisabled: boolean | null;
  isSAMsDisabled: boolean | null;
  isPeaceTime: boolean | null;
  isWaterNukes: boolean | null;
}

export interface ObservationHostCheatsSnapshot {
  infiniteGold: boolean | null;
  infiniteTroops: boolean | null;
  goldMultiplier: number | null;
  startingGold: number | null;
}

export interface ObservationGameConfigSnapshot {
  gameMap: GameMapName | null;
  difficulty: Difficulty | null;
  gameType: GameType | null;
  gameMode: GameMode | null;
  rankedType: RankedType | null;
  gameMapSize: GameMapSize | null;
  publicGameModifiers: ObservationPublicGameModifiersSnapshot | null;
  nations: number | "default" | "disabled" | null;
  bots: number | null;
  infiniteGold: boolean | null;
  donateGold: boolean | null;
  infiniteTroops: boolean | null;
  donateTroops: boolean | null;
  instantBuild: boolean | null;
  disableNavMesh: boolean | null;
  disableAlliances: boolean | null;
  waterNukes: boolean | null;
  randomSpawn: boolean | null;
  maxPlayers: number | null;
  maxTimerValueMinutes: number | null;
  spawnImmunityDurationTicks: number | null;
  disabledUnits: UnitTypeName[];
  playerTeams: TeamCountMode | null;
  goldMultiplier: number | null;
  startingGold: number | null;
  hostCheats: ObservationHostCheatsSnapshot | null;
}

export interface ObservationConfigSnapshot {
  rawGameConfig: ObservationGameConfigSnapshot;
  resolved: {
    numSpawnPhaseTurns: number;
    spawnImmunityDurationTicks: number;
    nationSpawnImmunityDurationTicks: number | null;
    disableAlliances: boolean;
    waterNukes: boolean;
    randomSpawn: boolean;
    hasExtendedSpawnImmunity: boolean | null;
    replayMode: boolean | null;
  };
}

export interface ObservationSourceMetadata {
  adapterVersion: typeof OBSERVATION_ADAPTER_VERSION;
  pinnedCommit: typeof PINNED_COMMIT;
  capturedAtIso: string;
}

export interface ObservationGameMetadata {
  gameID: string | null;
  tick: number;
  phase: "spawn" | "active";
  map: {
    width: number;
    height: number;
    landTileCount: number | null;
    gameMap: GameMapName | null;
    gameMapSize: GameMapSize | null;
  };
  session: {
    myClientID: ProtocolId | null;
    difficulty: Difficulty | null;
    gameType: GameType | null;
    gameMode: GameMode | null;
    rankedType: RankedType | null;
    playerCount: number;
    humanPlayerCount: number;
    botPlayerCount: number;
    nationPlayerCount: number;
    spawnImmunityActive: boolean;
    nationSpawnImmunityActive: boolean;
    paused: boolean | null;
  };
}

export interface ObservationOwnPlayerState {
  playerId: ProtocolId;
  clientID: ProtocolId | null;
  smallID: number;
  name: string;
  displayName: string;
  playerType: ObservationPlayerType;
  team: string | null;
  isAlive: boolean;
  hasSpawned: boolean;
  isDisconnected: boolean;
  isTraitor: boolean;
  traitorRemainingTicks: number | null;
  isLobbyCreator: boolean;
  tilesOwned: number;
  troops: number;
  gold: string;
}

export interface ObservationOwnedUnitCount {
  type: UnitTypeName;
  count: number;
  readyCount: number;
  underConstructionCount: number;
  totalLevel: number;
}

export interface ObservationEconomyState {
  gold: string;
  troops: number;
  maxTroops: number | null;
  passiveGoldPerTick: string | null;
  troopIncreasePerTick: number | null;
  ownedUnitCounts: ObservationOwnedUnitCount[];
}

export interface ObservationFrontiers {
  ownBorderTileRefs: TileRefLike[] | null;
  ownBorderTileCount: number | null;
  adjacentPlayerIds: ProtocolId[];
  adjacentFriendlyPlayerIds: ProtocolId[];
  adjacentHostilePlayerIds: ProtocolId[];
  adjacentFriendlyPlayers: ObservationAdjacentPlayerFrontier[];
  adjacentHostilePlayers: ObservationAdjacentPlayerFrontier[];
  nearbyFrontierTileRefs: TileRefLike[];
  nearbyFrontierTiles: ObservationTilePosition[];
  cheapExpansionCandidates: ObservationExpansionCandidate[];
}

export interface ObservationAdjacentPlayerFrontier {
  playerId: ProtocolId;
  borderTileRefs: TileRefLike[];
  targetTileRefs: TileRefLike[];
}

export interface ObservationExpansionCandidate {
  tile: ObservationTilePosition;
  adjacentOwnBorderTileRefs: TileRefLike[];
  supportCount: number;
}

export interface ObservationAllianceSnapshot {
  allianceId: number;
  otherPlayerId: ProtocolId;
  createdAtTick: number;
  expiresAtTick: number;
  hasExtensionRequest: boolean;
}

export interface ObservationDiplomacyPlayer {
  playerId: ProtocolId;
  smallID: number;
  displayName: string;
  playerType: ObservationPlayerType;
  team: string | null;
  isAlive: boolean;
  isDisconnected: boolean;
  hasSpawned: boolean;
  tilesOwned: number;
  troops: number;
  gold: string;
  isAlliedWithMe: boolean;
  isOnSameTeamAsMe: boolean;
  isFriendlyToMe: boolean;
  iEmbargoThem: boolean;
  theyEmbargoMe: boolean;
  iTargetThem: boolean;
  theyTargetMe: boolean;
}

export interface ObservationDiplomacyState {
  allyPlayerIds: ProtocolId[];
  targetPlayerIds: ProtocolId[];
  outgoingAllianceRequestPlayerIds: ProtocolId[];
  embargoedPlayerIds: ProtocolId[];
  embargoedByPlayerIds: ProtocolId[];
  activeAlliances: ObservationAllianceSnapshot[];
  players: ObservationDiplomacyPlayer[];
}

export interface ObservationVisibleEntity {
  id: number;
  type: UnitTypeName;
  ownerPlayerId: ProtocolId;
  ownerSmallID: number;
  position: ObservationTilePosition;
  troops: number;
  level: number | null;
  health: number | null;
  isActive: boolean;
  isUnderConstruction: boolean;
  isTargetable: boolean | null;
  reachedTarget: boolean | null;
  targetTile: ObservationTilePosition | null;
  markedForDeletionAtTick: number | null;
  hasTrainStation: boolean | null;
  trainType: string | null;
  isLoaded: boolean | null;
}

export interface ObservationSpawnState {
  candidatesAvailable: boolean;
  legalTileRefs: TileRefLike[] | null;
  legalTiles: ObservationTilePosition[] | null;
  candidateCount: number | null;
  firstLegalTileRef: TileRefLike | null;
  actionable: boolean;
  blockedReason: string | null;
}

export interface Observation {
  source: ObservationSourceMetadata;
  game: ObservationGameMetadata;
  ownPlayer: ObservationOwnPlayerState | null;
  economy: ObservationEconomyState | null;
  configSnapshot: ObservationConfigSnapshot;
  spawn: ObservationSpawnState;
  frontiers: ObservationFrontiers | null;
  diplomacy: ObservationDiplomacyState | null;
  visibleUnits: ObservationVisibleEntity[];
  visibleStructures: ObservationVisibleEntity[];
}

export interface ObservationAllianceViewLike {
  id: number;
  other: ProtocolId;
  createdAt: number;
  expiresAt: number;
  hasExtensionRequest: boolean;
}

export interface ObservationBorderTilesLike {
  borderTiles: Iterable<TileRefLike>;
}

export interface ObservationUnitInfoLike {
  constructionDuration?: number;
  upgradable?: boolean;
}

export interface ObservationConfigLike {
  gameConfig(): ObservationRuntimeGameConfigLike;
  numSpawnPhaseTurns(): number;
  spawnImmunityDuration(): number;
  nationSpawnImmunityDuration?(): number;
  disableAlliances(): boolean;
  waterNukes(): boolean;
  isRandomSpawn(): boolean;
  hasExtendedSpawnImmunity?(): boolean;
  isReplay?(): boolean;
  maxTroops?(player: ObservationPlayerLike): number;
  goldAdditionRate?(player: ObservationPlayerLike): GoldLike;
  troopIncreaseRate?(player: ObservationPlayerLike): number;
  unitInfo(type: UnitTypeName): ObservationUnitInfoLike;
}

export interface ObservationPlayerLike {
  id(): ProtocolId;
  clientID(): ProtocolId | null;
  smallID(): number;
  name(): string;
  displayName(): string;
  type(): ObservationPlayerType;
  team(): string | null;
  isAlive(): boolean;
  hasSpawned(): boolean;
  isDisconnected(): boolean;
  isTraitor(): boolean;
  getTraitorRemainingTicks?(): number;
  isLobbyCreator(): boolean;
  numTilesOwned(): number;
  troops(): number;
  gold(): GoldLike;
  allies(): ObservationPlayerLike[];
  targets(): ObservationPlayerLike[];
  alliances(): ObservationAllianceViewLike[];
  isAlliedWith(other: ObservationPlayerLike): boolean;
  isOnSameTeam(other: ObservationPlayerLike): boolean;
  isFriendly(other: ObservationPlayerLike): boolean;
  hasEmbargoAgainst(other: ObservationPlayerLike): boolean;
  isRequestingAllianceWith?(other: ObservationPlayerLike): boolean;
  units(...types: UnitTypeName[]): ObservationUnitLike[];
  borderTiles?(): MaybePromise<ObservationBorderTilesLike>;
}

export interface ObservationUnitLike {
  id(): number;
  type(): UnitTypeName;
  owner(): ObservationPlayerLike | ObservationTerraNulliusLike;
  tile(): TileRefLike;
  troops(): number;
  isActive(): boolean;
  isUnderConstruction?(): boolean;
  hasHealth?(): boolean;
  health?(): number;
  level?(): number;
  targetable?(): boolean;
  reachedTarget?(): boolean;
  targetTile?(): TileRefLike | undefined;
  markedForDeletion?(): number | false;
  hasTrainStation?(): boolean;
  trainType?(): string | undefined;
  isLoaded?(): boolean | undefined;
}

export interface ObservationTerraNulliusLike {
  isPlayer(): false;
  id(): null;
}

export interface ObservationRuntimeGameConfigLike {
  gameMap?: GameMapName;
  difficulty?: Difficulty;
  donateGold?: boolean;
  donateTroops?: boolean;
  gameType?: GameType;
  gameMode?: GameMode;
  rankedType?: RankedType;
  gameMapSize?: GameMapSize;
  publicGameModifiers?: PublicGameModifiersUpdate;
  nations?: number | "default" | "disabled";
  bots?: number;
  infiniteGold?: boolean;
  infiniteTroops?: boolean;
  instantBuild?: boolean;
  disableNavMesh?: boolean;
  disableAlliances?: boolean | null;
  waterNukes?: boolean | null;
  randomSpawn?: boolean;
  maxPlayers?: number;
  maxTimerValue?: number | null;
  spawnImmunityDuration?: number | null;
  disabledUnits?: readonly UnitTypeName[];
  playerTeams?: TeamCountMode;
  goldMultiplier?: number | null;
  startingGold?: number | null;
  hostCheats?: HostCheatsUpdate;
}

export interface ObservationGameLike {
  config(): ObservationConfigLike;
  players(): ObservationPlayerLike[];
  units(...types: UnitTypeName[]): ObservationUnitLike[];
  ref?(x: number, y: number): TileRefLike;
  width(): number;
  height(): number;
  x(tile: TileRefLike): number;
  y(tile: TileRefLike): number;
  ticks(): number;
  inSpawnPhase(): boolean;
  myPlayer?(): ObservationPlayerLike | null;
  myClientID?(): ProtocolId | undefined;
  gameID?(): string;
  numLandTiles?(): number;
  isLand?(tile: TileRefLike): boolean;
  isSpawnImmunityActive?(): boolean;
  isNationSpawnImmunityActive?(): boolean;
  neighbors?(tile: TileRefLike): TileRefLike[];
  hasOwner?(tile: TileRefLike): boolean;
  owner?(tile: TileRefLike): ObservationPlayerLike | ObservationTerraNulliusLike;
}

export async function buildObservation(runtime: unknown): Promise<Observation> {
  return normalizeObservation(resolveObservationGame(runtime));
}

export async function normalizeObservation(
  game: ObservationGameLike,
): Promise<Observation> {
  const config = game.config();
  const rawGameConfig = config.gameConfig();
  const players = sortPlayers(game.players());
  const myPlayer = game.myPlayer?.() ?? null;
  const now = new Date().toISOString();

  const allEntities = sortUnits(game.units()).map((unit) =>
    normalizeVisibleEntity(game, unit),
  );

  return {
    source: {
      adapterVersion: OBSERVATION_ADAPTER_VERSION,
      pinnedCommit: PINNED_COMMIT,
      capturedAtIso: now,
    },
    game: normalizeGameMetadata(game, rawGameConfig, players),
    ownPlayer: myPlayer ? normalizeOwnPlayer(myPlayer) : null,
    economy: myPlayer ? normalizeEconomy(config, myPlayer) : null,
    configSnapshot: normalizeConfigSnapshot(config, rawGameConfig),
    spawn: normalizeSpawnState(game, myPlayer),
    frontiers: myPlayer ? await normalizeFrontiers(game, myPlayer) : null,
    diplomacy: myPlayer ? normalizeDiplomacy(myPlayer, players) : null,
    visibleUnits: allEntities.filter((entity) => !isStructureEntity(game, entity)),
    visibleStructures: allEntities.filter((entity) =>
      isStructureEntity(game, entity),
    ),
  };
}

function normalizeGameMetadata(
  game: ObservationGameLike,
  rawGameConfig: ObservationRuntimeGameConfigLike,
  players: ObservationPlayerLike[],
): ObservationGameMetadata {
  let humanPlayerCount = 0;
  let botPlayerCount = 0;
  let nationPlayerCount = 0;

  for (const player of players) {
    switch (player.type()) {
      case "HUMAN":
        humanPlayerCount++;
        break;
      case "BOT":
        botPlayerCount++;
        break;
      case "NATION":
        nationPlayerCount++;
        break;
      default:
        break;
    }
  }

  return {
    gameID: game.gameID?.() ?? null,
    tick: game.ticks(),
    phase: game.inSpawnPhase() ? "spawn" : "active",
    map: {
      width: game.width(),
      height: game.height(),
      landTileCount: game.numLandTiles?.() ?? null,
      gameMap: rawGameConfig.gameMap ?? null,
      gameMapSize: rawGameConfig.gameMapSize ?? null,
    },
    session: {
      myClientID: game.myClientID?.() ?? null,
      difficulty: rawGameConfig.difficulty ?? null,
      gameType: rawGameConfig.gameType ?? null,
      gameMode: rawGameConfig.gameMode ?? null,
      rankedType: rawGameConfig.rankedType ?? null,
      playerCount: players.length,
      humanPlayerCount,
      botPlayerCount,
      nationPlayerCount,
      spawnImmunityActive: computeSpawnImmunityActive(game),
      nationSpawnImmunityActive: computeNationSpawnImmunityActive(game),
      // TODO: GameView does not keep a stable paused flag; wire this through
      // RuntimeHooks instead of guessing from transient updates.
      paused: null,
    },
  };
}

function normalizeOwnPlayer(
  player: ObservationPlayerLike,
): ObservationOwnPlayerState {
  return {
    playerId: player.id(),
    clientID: player.clientID(),
    smallID: player.smallID(),
    name: player.name(),
    displayName: player.displayName(),
    playerType: player.type(),
    team: player.team(),
    isAlive: player.isAlive(),
    hasSpawned: player.hasSpawned(),
    isDisconnected: player.isDisconnected(),
    isTraitor: player.isTraitor(),
    traitorRemainingTicks: player.getTraitorRemainingTicks?.() ?? null,
    isLobbyCreator: player.isLobbyCreator(),
    tilesOwned: player.numTilesOwned(),
    troops: player.troops(),
    gold: normalizeGold(player.gold()),
  };
}

function normalizeEconomy(
  config: ObservationConfigLike,
  player: ObservationPlayerLike,
): ObservationEconomyState {
  const ownedUnitCounts = new Map<UnitTypeName, ObservationOwnedUnitCount>();

  for (const unit of sortUnits(player.units())) {
    const current =
      ownedUnitCounts.get(unit.type()) ??
      ({
        type: unit.type(),
        count: 0,
        readyCount: 0,
        underConstructionCount: 0,
        totalLevel: 0,
      } satisfies ObservationOwnedUnitCount);

    current.count += 1;
    if (unit.isUnderConstruction?.() === true) {
      current.underConstructionCount += 1;
    } else {
      current.readyCount += 1;
    }
    current.totalLevel += unit.level?.() ?? 0;
    ownedUnitCounts.set(unit.type(), current);
  }

  return {
    gold: normalizeGold(player.gold()),
    troops: player.troops(),
    maxTroops: config.maxTroops?.(player) ?? null,
    passiveGoldPerTick: normalizeOptionalGold(config.goldAdditionRate?.(player)),
    troopIncreasePerTick: config.troopIncreaseRate?.(player) ?? null,
    ownedUnitCounts: Array.from(ownedUnitCounts.values()).sort((left, right) =>
      left.type.localeCompare(right.type),
    ),
  };
}

function normalizeConfigSnapshot(
  config: ObservationConfigLike,
  rawGameConfig: ObservationRuntimeGameConfigLike,
): ObservationConfigSnapshot {
  return {
    rawGameConfig: {
      gameMap: rawGameConfig.gameMap ?? null,
      difficulty: rawGameConfig.difficulty ?? null,
      gameType: rawGameConfig.gameType ?? null,
      gameMode: rawGameConfig.gameMode ?? null,
      rankedType: rawGameConfig.rankedType ?? null,
      gameMapSize: rawGameConfig.gameMapSize ?? null,
      publicGameModifiers: normalizePublicGameModifiers(
        rawGameConfig.publicGameModifiers,
      ),
      nations: rawGameConfig.nations ?? null,
      bots: rawGameConfig.bots ?? null,
      infiniteGold: rawGameConfig.infiniteGold ?? null,
      donateGold: rawGameConfig.donateGold ?? null,
      infiniteTroops: rawGameConfig.infiniteTroops ?? null,
      donateTroops: rawGameConfig.donateTroops ?? null,
      instantBuild: rawGameConfig.instantBuild ?? null,
      disableNavMesh: rawGameConfig.disableNavMesh ?? null,
      disableAlliances: rawGameConfig.disableAlliances ?? null,
      waterNukes: rawGameConfig.waterNukes ?? null,
      randomSpawn: rawGameConfig.randomSpawn ?? null,
      maxPlayers: rawGameConfig.maxPlayers ?? null,
      maxTimerValueMinutes: rawGameConfig.maxTimerValue ?? null,
      spawnImmunityDurationTicks: rawGameConfig.spawnImmunityDuration ?? null,
      disabledUnits: normalizeUnitTypeList(rawGameConfig.disabledUnits),
      playerTeams: rawGameConfig.playerTeams ?? null,
      goldMultiplier: rawGameConfig.goldMultiplier ?? null,
      startingGold: rawGameConfig.startingGold ?? null,
      hostCheats: normalizeHostCheats(rawGameConfig.hostCheats),
    },
    resolved: {
      numSpawnPhaseTurns: config.numSpawnPhaseTurns(),
      spawnImmunityDurationTicks: config.spawnImmunityDuration(),
      nationSpawnImmunityDurationTicks:
        config.nationSpawnImmunityDuration?.() ?? null,
      disableAlliances: config.disableAlliances(),
      waterNukes: config.waterNukes(),
      randomSpawn: config.isRandomSpawn(),
      hasExtendedSpawnImmunity: config.hasExtendedSpawnImmunity?.() ?? null,
      replayMode: config.isReplay?.() ?? null,
    },
  };
}

function normalizeSpawnState(
  game: ObservationGameLike,
  player: ObservationPlayerLike | null,
): ObservationSpawnState {
  if (!player) {
    return {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "own_player_missing",
    };
  }

  if (player.hasSpawned()) {
    return {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "player_already_spawned",
    };
  }

  if (!game.inSpawnPhase()) {
    return {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "not_in_spawn_phase",
    };
  }

  if (game.config().isRandomSpawn()) {
    return {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "random_spawn_is_automatic",
    };
  }

  if (
    typeof game.ref !== "function" ||
    typeof game.isLand !== "function" ||
    typeof game.hasOwner !== "function"
  ) {
    return {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "spawn_candidate_surface_unavailable",
    };
  }

  // Pinned-source grounding:
  // - `ClientGameRunner` only dispatches manual spawn clicks in spawn phase when
  //   the clicked tile is land and unowned and random spawn is disabled.
  // - `SpawnExecution` then expands from the chosen center using
  //   `getSpawnTiles(..., requireAllValid=false)` rather than extra client-side
  //   legality heuristics.
  const legalTileRefs: TileRefLike[] = [];
  for (let y = 0; y < game.height(); y++) {
    for (let x = 0; x < game.width(); x++) {
      const tileRef = game.ref(x, y);
      if (!game.isLand(tileRef) || game.hasOwner(tileRef)) {
        continue;
      }
      legalTileRefs.push(tileRef);
    }
  }

  const sortedLegalTileRefs = sortNumbers(legalTileRefs);
  const legalTiles = sortedLegalTileRefs.map((tileRef) =>
    normalizeTilePosition(game, tileRef),
  );

  return {
    candidatesAvailable: true,
    legalTileRefs: sortedLegalTileRefs,
    legalTiles,
    candidateCount: sortedLegalTileRefs.length,
    firstLegalTileRef: sortedLegalTileRefs[0] ?? null,
    actionable: sortedLegalTileRefs.length > 0,
    blockedReason:
      sortedLegalTileRefs.length > 0 ? null : "no_legal_spawn_tiles",
  };
}

async function normalizeFrontiers(
  game: ObservationGameLike,
  player: ObservationPlayerLike,
): Promise<ObservationFrontiers> {
  const borderFetch = player.borderTiles;
  if (typeof borderFetch !== "function") {
    return {
      ownBorderTileRefs: null,
      ownBorderTileCount: null,
      adjacentPlayerIds: [],
      adjacentFriendlyPlayerIds: [],
      adjacentHostilePlayerIds: [],
      adjacentFriendlyPlayers: [],
      adjacentHostilePlayers: [],
      nearbyFrontierTileRefs: [],
      nearbyFrontierTiles: [],
      cheapExpansionCandidates: [],
    };
  }

  let borderTiles: number[] | null = null;
  try {
    borderTiles = sortNumbers(
      toNumberArray((await borderFetch.call(player)).borderTiles),
    );
  } catch {
    return {
      ownBorderTileRefs: null,
      ownBorderTileCount: null,
      adjacentPlayerIds: [],
      adjacentFriendlyPlayerIds: [],
      adjacentHostilePlayerIds: [],
      adjacentFriendlyPlayers: [],
      adjacentHostilePlayers: [],
      nearbyFrontierTileRefs: [],
      nearbyFrontierTiles: [],
      cheapExpansionCandidates: [],
    };
  }

  const adjacentPlayerIds = new Set<ProtocolId>();
  const adjacentFriendlyPlayerIds = new Set<ProtocolId>();
  const adjacentHostilePlayerIds = new Set<ProtocolId>();
  const adjacentFriendlyPlayers = new Map<
    ProtocolId,
    { borderTileRefs: Set<TileRefLike>; targetTileRefs: Set<TileRefLike> }
  >();
  const adjacentHostilePlayers = new Map<
    ProtocolId,
    { borderTileRefs: Set<TileRefLike>; targetTileRefs: Set<TileRefLike> }
  >();
  const nearbyFrontierTileRefs = new Set<TileRefLike>();
  const cheapExpansionCandidates = new Map<TileRefLike, Set<TileRefLike>>();

  if (
    typeof game.neighbors === "function" &&
    typeof game.hasOwner === "function" &&
    typeof game.owner === "function" &&
    typeof game.isLand === "function"
  ) {
    for (const tile of borderTiles) {
      for (const neighbor of game.neighbors(tile)) {
        if (!game.isLand(neighbor)) {
          continue;
        }

        if (!game.hasOwner(neighbor)) {
          nearbyFrontierTileRefs.add(neighbor);
          const support =
            cheapExpansionCandidates.get(neighbor) ?? new Set<TileRefLike>();
          support.add(tile);
          cheapExpansionCandidates.set(neighbor, support);
          continue;
        }

        const owner = game.owner(neighbor);
        if (!isObservationPlayer(owner) || owner.id() === player.id()) {
          continue;
        }

        adjacentPlayerIds.add(owner.id());
        if (player.isFriendly(owner)) {
          adjacentFriendlyPlayerIds.add(owner.id());
          const contact = ensureFrontierContact(adjacentFriendlyPlayers, owner.id());
          contact.borderTileRefs.add(tile);
          contact.targetTileRefs.add(neighbor);
        } else {
          adjacentHostilePlayerIds.add(owner.id());
          const contact = ensureFrontierContact(adjacentHostilePlayers, owner.id());
          contact.borderTileRefs.add(tile);
          contact.targetTileRefs.add(neighbor);
        }
      }
    }
  }

  return {
    ownBorderTileRefs: borderTiles,
    ownBorderTileCount: borderTiles.length,
    adjacentPlayerIds: sortProtocolIds(adjacentPlayerIds),
    adjacentFriendlyPlayerIds: sortProtocolIds(adjacentFriendlyPlayerIds),
    adjacentHostilePlayerIds: sortProtocolIds(adjacentHostilePlayerIds),
    adjacentFriendlyPlayers: normalizeAdjacentPlayerFrontiers(adjacentFriendlyPlayers),
    adjacentHostilePlayers: normalizeAdjacentPlayerFrontiers(adjacentHostilePlayers),
    nearbyFrontierTileRefs: sortNumbers(nearbyFrontierTileRefs),
    nearbyFrontierTiles: sortNumbers(nearbyFrontierTileRefs).map((tileRef) =>
      normalizeTilePosition(game, tileRef),
    ),
    cheapExpansionCandidates: normalizeExpansionCandidates(
      game,
      cheapExpansionCandidates,
    ),
  };
}

function normalizeDiplomacy(
  myPlayer: ObservationPlayerLike,
  players: ObservationPlayerLike[],
): ObservationDiplomacyState {
  const others = players.filter((player) => player.id() !== myPlayer.id());
  const myTargetIds = new Set(myPlayer.targets().map((target) => target.id()));

  return {
    allyPlayerIds: normalizePlayerIds(myPlayer.allies()),
    targetPlayerIds: normalizePlayerIds(myPlayer.targets()),
    outgoingAllianceRequestPlayerIds: normalizePlayerIds(
      others.filter((other) => myPlayer.isRequestingAllianceWith?.(other) === true),
    ),
    embargoedPlayerIds: normalizePlayerIds(
      others.filter((other) => myPlayer.hasEmbargoAgainst(other)),
    ),
    embargoedByPlayerIds: normalizePlayerIds(
      others.filter((other) => other.hasEmbargoAgainst(myPlayer)),
    ),
    activeAlliances: myPlayer
      .alliances()
      .map((alliance) => ({
        allianceId: alliance.id,
        otherPlayerId: alliance.other,
        createdAtTick: alliance.createdAt,
        expiresAtTick: alliance.expiresAt,
        hasExtensionRequest: alliance.hasExtensionRequest,
      }))
      .sort((left, right) => {
        if (left.otherPlayerId !== right.otherPlayerId) {
          return left.otherPlayerId.localeCompare(right.otherPlayerId);
        }
        return left.allianceId - right.allianceId;
      }),
    players: others.map((other) => ({
      playerId: other.id(),
      smallID: other.smallID(),
      displayName: other.displayName(),
      playerType: other.type(),
      team: other.team(),
      isAlive: other.isAlive(),
      isDisconnected: other.isDisconnected(),
      hasSpawned: other.hasSpawned(),
      tilesOwned: other.numTilesOwned(),
      troops: other.troops(),
      gold: normalizeGold(other.gold()),
      isAlliedWithMe: myPlayer.isAlliedWith(other),
      isOnSameTeamAsMe: myPlayer.isOnSameTeam(other),
      isFriendlyToMe: myPlayer.isFriendly(other),
      iEmbargoThem: myPlayer.hasEmbargoAgainst(other),
      theyEmbargoMe: other.hasEmbargoAgainst(myPlayer),
      iTargetThem: myTargetIds.has(other.id()),
      theyTargetMe: other.targets().some((target) => target.id() === myPlayer.id()),
    })),
  };
}

function normalizeVisibleEntity(
  game: ObservationGameLike,
  unit: ObservationUnitLike,
): ObservationVisibleEntity {
  const owner = unit.owner();
  if (!isObservationPlayer(owner)) {
    throw new Error(
      `ObservationAdapter expected a player-owned unit, got unit ${unit.id()} without a player owner`,
    );
  }

  const targetTile = unit.targetTile?.();

  return {
    id: unit.id(),
    type: unit.type(),
    ownerPlayerId: owner.id(),
    ownerSmallID: owner.smallID(),
    position: normalizeTilePosition(game, unit.tile()),
    troops: unit.troops(),
    level: unit.level?.() ?? null,
    health:
      unit.hasHealth?.() === true || unit.health?.() !== undefined
        ? unit.health?.() ?? null
        : null,
    isActive: unit.isActive(),
    isUnderConstruction: unit.isUnderConstruction?.() ?? false,
    isTargetable: unit.targetable?.() ?? null,
    reachedTarget: unit.reachedTarget?.() ?? null,
    targetTile:
      targetTile !== undefined ? normalizeTilePosition(game, targetTile) : null,
    markedForDeletionAtTick: normalizeMarkedForDeletion(unit.markedForDeletion?.()),
    hasTrainStation: unit.hasTrainStation?.() ?? null,
    trainType: unit.trainType?.() ?? null,
    isLoaded: unit.isLoaded?.() ?? null,
  };
}

function resolveObservationGame(runtime: unknown): ObservationGameLike {
  if (isObservationGameLike(runtime)) {
    return runtime;
  }
  if (isRecord(runtime) && isObservationGameLike(runtime.gameView)) {
    return runtime.gameView;
  }
  if (isRecord(runtime) && isObservationGameLike(runtime.game)) {
    return runtime.game;
  }
  throw new Error(
    "ObservationAdapter expected a GameView-like object or an object containing .gameView / .game",
  );
}

function isObservationGameLike(value: unknown): value is ObservationGameLike {
  return (
    isRecord(value) &&
    typeof value.config === "function" &&
    typeof value.players === "function" &&
    typeof value.units === "function" &&
    typeof value.width === "function" &&
    typeof value.height === "function" &&
    typeof value.x === "function" &&
    typeof value.y === "function" &&
    typeof value.ticks === "function" &&
    typeof value.inSpawnPhase === "function"
  );
}

function isObservationPlayer(
  value: ObservationPlayerLike | ObservationTerraNulliusLike | null | undefined,
): value is ObservationPlayerLike {
  return Boolean(value && typeof (value as ObservationPlayerLike).smallID === "function");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeTilePosition(
  game: ObservationGameLike,
  tileRef: TileRefLike,
): ObservationTilePosition {
  return {
    tileRef,
    x: game.x(tileRef),
    y: game.y(tileRef),
  };
}

function normalizeMarkedForDeletion(value: number | false | undefined): number | null {
  return typeof value === "number" ? value : null;
}

function isStructureEntity(
  game: ObservationGameLike,
  entity: ObservationVisibleEntity,
): boolean {
  const info = game.config().unitInfo(entity.type);
  return info.constructionDuration !== undefined || info.upgradable === true;
}

function computeSpawnImmunityActive(game: ObservationGameLike): boolean {
  if (game.inSpawnPhase()) {
    return false;
  }

  if (typeof game.isSpawnImmunityActive === "function") {
    return game.isSpawnImmunityActive();
  }

  const config = game.config();
  return config.numSpawnPhaseTurns() + config.spawnImmunityDuration() > game.ticks();
}

function computeNationSpawnImmunityActive(game: ObservationGameLike): boolean {
  if (typeof game.isNationSpawnImmunityActive === "function") {
    return game.isNationSpawnImmunityActive();
  }

  const nationSpawnImmunityDuration =
    game.config().nationSpawnImmunityDuration?.() ?? 0;
  return game.config().numSpawnPhaseTurns() + nationSpawnImmunityDuration > game.ticks();
}

function normalizePublicGameModifiers(
  modifiers: PublicGameModifiersUpdate | undefined,
): ObservationPublicGameModifiersSnapshot | null {
  if (!modifiers) {
    return null;
  }

  return {
    isCompact: modifiers.isCompact ?? null,
    isRandomSpawn: modifiers.isRandomSpawn ?? null,
    isCrowded: modifiers.isCrowded ?? null,
    isHardNations: modifiers.isHardNations ?? null,
    startingGold: modifiers.startingGold ?? null,
    goldMultiplier: modifiers.goldMultiplier ?? null,
    isAlliancesDisabled: modifiers.isAlliancesDisabled ?? null,
    isPortsDisabled: modifiers.isPortsDisabled ?? null,
    isNukesDisabled: modifiers.isNukesDisabled ?? null,
    isSAMsDisabled: modifiers.isSAMsDisabled ?? null,
    isPeaceTime: modifiers.isPeaceTime ?? null,
    isWaterNukes: modifiers.isWaterNukes ?? null,
  };
}

function normalizeHostCheats(
  hostCheats: HostCheatsUpdate | undefined,
): ObservationHostCheatsSnapshot | null {
  if (!hostCheats) {
    return null;
  }

  return {
    infiniteGold: hostCheats.infiniteGold ?? null,
    infiniteTroops: hostCheats.infiniteTroops ?? null,
    goldMultiplier: hostCheats.goldMultiplier ?? null,
    startingGold: hostCheats.startingGold ?? null,
  };
}

function normalizeGold(value: GoldLike): string {
  return typeof value === "string" ? value : String(value);
}

function normalizeOptionalGold(value: GoldLike | undefined): string | null {
  return value === undefined ? null : normalizeGold(value);
}

function normalizeUnitTypeList(
  unitTypes: readonly UnitTypeName[] | undefined,
): UnitTypeName[] {
  if (!unitTypes) {
    return [];
  }
  return [...unitTypes].sort((left, right) => left.localeCompare(right));
}

function normalizePlayerIds(players: readonly ObservationPlayerLike[]): ProtocolId[] {
  return sortProtocolIds(players.map((player) => player.id()));
}

function sortPlayers(players: readonly ObservationPlayerLike[]): ObservationPlayerLike[] {
  return [...players].sort((left, right) => left.smallID() - right.smallID());
}

function sortUnits(units: readonly ObservationUnitLike[]): ObservationUnitLike[] {
  return [...units].sort((left, right) => left.id() - right.id());
}

function sortProtocolIds(ids: Iterable<ProtocolId>): ProtocolId[] {
  return [...ids].sort((left, right) => left.localeCompare(right));
}

function sortNumbers(values: Iterable<number>): number[] {
  return [...values].sort((left, right) => left - right);
}

function ensureFrontierContact(
  contacts: Map<
    ProtocolId,
    { borderTileRefs: Set<TileRefLike>; targetTileRefs: Set<TileRefLike> }
  >,
  playerId: ProtocolId,
): { borderTileRefs: Set<TileRefLike>; targetTileRefs: Set<TileRefLike> } {
  const current = contacts.get(playerId);
  if (current) {
    return current;
  }

  const created = {
    borderTileRefs: new Set<TileRefLike>(),
    targetTileRefs: new Set<TileRefLike>(),
  };
  contacts.set(playerId, created);
  return created;
}

function normalizeAdjacentPlayerFrontiers(
  contacts: Map<
    ProtocolId,
    { borderTileRefs: Set<TileRefLike>; targetTileRefs: Set<TileRefLike> }
  >,
): ObservationAdjacentPlayerFrontier[] {
  return [...contacts.entries()]
    .map(([playerId, contact]) => ({
      playerId,
      borderTileRefs: sortNumbers(contact.borderTileRefs),
      targetTileRefs: sortNumbers(contact.targetTileRefs),
    }))
    .sort((left, right) => left.playerId.localeCompare(right.playerId));
}

function normalizeExpansionCandidates(
  game: ObservationGameLike,
  candidates: Map<TileRefLike, Set<TileRefLike>>,
): ObservationExpansionCandidate[] {
  return [...candidates.entries()]
    .map(([tileRef, borderTileRefs]) => {
      const sortedBorderTileRefs = sortNumbers(borderTileRefs);
      return {
        tile: normalizeTilePosition(game, tileRef),
        adjacentOwnBorderTileRefs: sortedBorderTileRefs,
        supportCount: sortedBorderTileRefs.length,
      };
    })
    .sort((left, right) => {
      if (right.supportCount !== left.supportCount) {
        return right.supportCount - left.supportCount;
      }
      return left.tile.tileRef - right.tile.tileRef;
    });
}

function toNumberArray(values: Iterable<number>): number[] {
  const result: number[] = [];
  for (const value of values) {
    result.push(value);
  }
  return result;
}

// TODO: Incoming alliance requests and raw relation scores are available behind
// worker-backed surfaces (`Player.profile()` / game updates), but this skeleton
// keeps diplomacy limited to fields already exposed on the stable live views.
//
// TODO: If the policy layer needs frontier geometry rather than tile refs,
// confirm the correct source from GameMap/pathing helpers instead of inventing
// border segment semantics here.
//
// TODO: The browser currently normalizes whatever the live GameView exposes as
// visible. If future runtime hooks add fog-of-war or per-client visibility,
// extend this adapter with explicit visibility flags rather than assuming all
// active units are globally visible.
