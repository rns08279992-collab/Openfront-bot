import type { IntentAdapterAction } from "../../browser/page-adapter/IntentAdapter";
import type {
  Observation,
  ObservationDiplomacyPlayer,
} from "../../browser/page-adapter/ObservationAdapter";
import { interpretObservation } from "../../shared/interpreter/strategy-state";

export type BaselineBotAction = Extract<
  IntentAdapterAction,
  {
    type:
      | "spawn_at_tile"
      | "attack_player"
      | "upgrade_structure"
      | "request_alliance";
  }
>;

type BaselinePhase =
  | "spawn"
  | "opening_expansion"
  | "hold_defend"
  | "economy_build";

interface BaselinePhaseDecision {
  phase: BaselinePhase;
  action: BaselineBotAction | null;
  reason?: string;
}

const SAFE_ATTACK_TROOP_RATIO = 1.5;
const SAFE_ATTACK_TILE_RATIO = 1.1;
const MIN_ATTACK_TROOPS = 5_000;
const OPENING_TARGET_MEMORY_TICKS = 4;
const OPENING_ATTACK_DEBOUNCE_TICKS = 2;
const OPENING_EXPANSION_THROTTLE_TICKS = 3;
const OPENING_EXPANSION_STREAK_RESET_TICKS = 8;
const MAX_CONSECUTIVE_OPENING_EXPANSION_PUSHES = 2;
const MIN_OPENING_SUPPORT = 2;
const MIN_EXPANSION_RESERVE_TROOPS = 8_000;
const MIN_EXPANSION_TROOP_CAP_RATIO = 0.55;
const BUILD_PHASE_DEFER_REASON =
  "No safe build/economy action is confirmed in the current IntentAdapter surface, so the baseline defers this phase instead of inventing unsupported behavior.";
const GUARANTEED_ECONOMY_UPGRADE_GOLD = 1_000_000n;
const ECONOMY_UPGRADE_TYPE_PREFERENCE = ["Factory", "City", "Port"] as const;
const ECONOMY_UPGRADE_DISABLED_TYPES = new Set<string>(["Factory", "City", "Port"]);

type OpeningTargetKind = "expansion" | "hostile";

interface BaselineOpeningState {
  // Short-lived remembered opening target to keep one direction briefly.
  rememberedTarget: {
    kind: OpeningTargetKind;
    playerId: string | null;
    tileRef: number | null;
    expiresAtTick: number;
  } | null;
  // Last opening attack key/tick for simple anti-spam debounce.
  lastAttackKey: string | null;
  lastAttackTick: number | null;
  lastExpansionTick: number | null;
  consecutiveExpansionPushes: number;
}

const openingStateByPlayerId = new Map<string, BaselineOpeningState>();

type BaselineStrategyState = ReturnType<typeof interpretObservation>;

export function decideBaselineAction(
  observation: Observation,
): BaselineBotAction | null {
  if (!observation.ownPlayer) {
    return null;
  }

  const strategy = interpretObservation(observation);
  const openingState = getOpeningState(observation.ownPlayer.playerId);
  const phaseDecision = decideBaselinePhaseAction(
    observation,
    openingState,
    strategy,
  );
  return phaseDecision.action;
}

export const decideBaselineIntentAdapterAction = decideBaselineAction;

function decideBaselinePhaseAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselinePhaseDecision {
  const phase = chooseBaselinePhase(observation, openingState, strategy);

  switch (phase) {
    case "spawn": {
      const spawnAction = chooseSpawnAction(observation, strategy);
      if (spawnAction) {
        resetOpeningState(openingState);
      }
      return {
        phase,
        action: spawnAction,
      };
    }

    case "opening_expansion":
      return {
        phase,
        action: chooseOpeningExpansionPhaseAction(
          observation,
          openingState,
          strategy,
        ),
      };

    case "hold_defend":
      return {
        phase,
        action: chooseHoldDefendPhaseAction(observation, openingState, strategy),
      };

    case "economy_build":
      return chooseEconomyBuildPhaseAction(observation, openingState, strategy);
  }
}

function chooseBaselinePhase(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselinePhase {
  const player = observation.ownPlayer;
  if (!player || !player.hasSpawned) {
    return "spawn";
  }

  if (!player.isAlive) {
    resetOpeningState(openingState);
    return "hold_defend";
  }

  if (shouldHoldDefensiveLine(observation, strategy)) {
    return "hold_defend";
  }

  if (shouldUseOpeningExpansionPhase(observation, openingState, strategy)) {
    return "opening_expansion";
  }

  return "economy_build";
}

function chooseOpeningExpansionPhaseAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselineBotAction | null {
  const rememberedOpeningAction = chooseRememberedOpeningAction(
    observation,
    openingState,
    strategy,
  );
  if (rememberedOpeningAction !== undefined) {
    return rememberedOpeningAction;
  }

  return (
    chooseCheapExpansionAction(observation, openingState, strategy) ??
    chooseAttackAction(observation, openingState, strategy) ??
    chooseAllianceAction(observation, openingState)
  );
}

function chooseHoldDefendPhaseAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselineBotAction | null {
  if (openingState.rememberedTarget?.kind === "expansion") {
    openingState.rememberedTarget = null;
  }
  openingState.consecutiveExpansionPushes = 0;

  return chooseAttackAction(observation, openingState, strategy);
}

function chooseEconomyBuildPhaseAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselinePhaseDecision {
  const economyBuildAction = chooseEconomyBuildAction(observation, openingState);
  return {
    phase: "economy_build",
    action:
      economyBuildAction ??
      chooseAttackAction(observation, openingState, strategy) ??
      chooseAllianceAction(observation, openingState),
    reason: economyBuildAction ? undefined : BUILD_PHASE_DEFER_REASON,
  };
}

function chooseSpawnAction(
  observation: Observation,
  strategy: BaselineStrategyState,
): BaselineBotAction | null {
  const player = observation.ownPlayer;
  if (!player || player.hasSpawned) {
    return null;
  }

  const spawnTile = getExplicitSpawnTileCandidate(observation, strategy);
  if (spawnTile === null) {
    return null;
  }

  return {
    type: "spawn_at_tile",
    tile: spawnTile,
  };
}

function chooseAttackAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselineBotAction | null {
  const player = observation.ownPlayer;
  const safeTargets = getSafeHostileTargets(observation);

  if (!player || !player.hasSpawned || safeTargets.length === 0) {
    return null;
  }

  if (!strategy.frontierCombat.safeAttackWindow.active) {
    return null;
  }

  if (shouldAvoidAggressiveOpeningAttack(observation, strategy)) {
    return null;
  }

  const target = chooseBestAttackTarget(player, safeTargets);
  return createHostileAttackAction(observation, openingState, target.playerId);
}

function chooseRememberedOpeningAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselineBotAction | null | undefined {
  const rememberedTarget = openingState.rememberedTarget;
  if (!rememberedTarget) {
    return undefined;
  }

  if (rememberedTarget.expiresAtTick < observation.game.tick) {
    openingState.rememberedTarget = null;
    return undefined;
  }

  if (rememberedTarget.kind === "expansion") {
    if (shouldStopAggressiveExpansion(observation, openingState, strategy)) {
      openingState.rememberedTarget = null;
      return undefined;
    }

    const candidate = findExpansionCandidateByTileRef(
      observation,
      rememberedTarget.tileRef,
    );
    if (!candidate) {
      openingState.rememberedTarget = null;
      return undefined;
    }

    return (
      createExpansionAction(observation, openingState, candidate.tile.tileRef) ??
      undefined
    );
  }

  if (shouldAvoidAggressiveOpeningAttack(observation, strategy)) {
    openingState.rememberedTarget = null;
    return undefined;
  }

  if (!findAdjacentHostileTarget(observation, rememberedTarget.playerId)) {
    openingState.rememberedTarget = null;
    return undefined;
  }

  return createHostileAttackAction(
    observation,
    openingState,
    rememberedTarget.playerId,
  );
}

function chooseAllianceAction(
  observation: Observation,
  openingState?: BaselineOpeningState,
): BaselineBotAction | null {
  const player = observation.ownPlayer;
  const frontiers = observation.frontiers;
  const diplomacy = observation.diplomacy;

  if (
    !player ||
    !player.hasSpawned ||
    !frontiers ||
    !diplomacy ||
    frontiers.ownBorderTileCount === null
  ) {
    return null;
  }

  if (observation.configSnapshot.resolved.disableAlliances) {
    return null;
  }

  if (frontiers.adjacentHostilePlayers.length > 0) {
    return null;
  }

  const candidates = getUniqueDiplomacyPlayers(
    diplomacy.players,
    frontiers.adjacentFriendlyPlayers.map((frontier) => frontier.playerId),
  ).filter((candidate) => isTrivialAllianceCandidate(observation, candidate));

  if (candidates.length === 0) {
    return null;
  }

  const candidate = chooseBestAllianceCandidate(candidates);
  if (openingState) {
    openingState.rememberedTarget = null;
    openingState.consecutiveExpansionPushes = 0;
  }

  return {
    type: "request_alliance",
    recipientPlayerId: candidate.playerId,
  };
}

function chooseCheapExpansionAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): BaselineBotAction | null {
  const player = observation.ownPlayer;
  const frontiers = observation.frontiers;

  if (
    !player ||
    !player.hasSpawned ||
    !player.isAlive ||
    !frontiers ||
    frontiers.ownBorderTileCount === null
  ) {
    return null;
  }

  if (shouldStopAggressiveExpansion(observation, openingState, strategy)) {
    return null;
  }

  const candidate =
    strategy.frontierCombat.bestExpansionCandidate ??
    chooseBestExpansionCandidate(frontiers);
  if (!candidate) {
    return null;
  }

  return createExpansionAction(observation, openingState, candidate.tile.tileRef);
}

function chooseEconomyBuildAction(
  observation: Observation,
  _openingState: BaselineOpeningState,
): BaselineBotAction | null {
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer || !ownPlayer.hasSpawned || !ownPlayer.isAlive) {
    return null;
  }

  const availableGold = parseObservationGold(ownPlayer.gold);
  if (
    availableGold === null ||
    availableGold < GUARANTEED_ECONOMY_UPGRADE_GOLD
  ) {
    return null;
  }

  const disabledUnits = new Set(
    observation.configSnapshot.rawGameConfig.disabledUnits,
  );
  const candidates = observation.visibleStructures.filter((structure) => {
    if (structure.ownerPlayerId !== ownPlayer.playerId) {
      return false;
    }
    if (structure.isUnderConstruction || !structure.isActive) {
      return false;
    }
    if (structure.level === null) {
      return false;
    }
    if (!ECONOMY_UPGRADE_DISABLED_TYPES.has(structure.type)) {
      return false;
    }
    return !disabledUnits.has(structure.type);
  });

  const candidate = [...candidates].sort(compareEconomyUpgradeCandidate)[0];
  if (!candidate) {
    return null;
  }

  return {
    type: "upgrade_structure",
    unit: candidate.type,
    unitId: candidate.id,
  };
}

function getExplicitSpawnTileCandidate(
  observation: Observation,
  strategy: BaselineStrategyState,
): number | null {
  const player = observation.ownPlayer;
  const spawn = observation.spawn;

  if (!player || player.hasSpawned || !spawn.actionable) {
    return null;
  }

  if (strategy.spawnOpening.recommendedSpawn?.tile.tileRef !== undefined) {
    return strategy.spawnOpening.recommendedSpawn.tile.tileRef;
  }

  if (spawn.firstLegalTileRef !== null) {
    return spawn.firstLegalTileRef;
  }

  if (spawn.legalTileRefs && spawn.legalTileRefs.length > 0) {
    return spawn.legalTileRefs[0];
  }

  if (spawn.legalTiles && spawn.legalTiles.length > 0) {
    return spawn.legalTiles[0].tileRef;
  }

  return null;
}

function isClearlySafeAttackTarget(
  player: NonNullable<Observation["ownPlayer"]>,
  target: ObservationDiplomacyPlayer,
): boolean {
  if (
    player.playerId === target.playerId ||
    !target.isAlive ||
    !target.hasSpawned ||
    target.isDisconnected
  ) {
    return false;
  }

  if (
    target.isFriendlyToMe ||
    target.isAlliedWithMe ||
    target.isOnSameTeamAsMe ||
    target.iEmbargoThem ||
    target.theyEmbargoMe
  ) {
    return false;
  }

  if (player.troops < MIN_ATTACK_TROOPS) {
    return false;
  }

  if (target.troops <= 0 || target.tilesOwned <= 0) {
    return false;
  }

  return (
    player.troops / target.troops >= SAFE_ATTACK_TROOP_RATIO &&
    player.tilesOwned / target.tilesOwned >= SAFE_ATTACK_TILE_RATIO
  );
}

function isTrivialAllianceCandidate(
  observation: Observation,
  candidate: ObservationDiplomacyPlayer,
): boolean {
  const player = observation.ownPlayer;
  const diplomacy = observation.diplomacy;
  if (!player || !diplomacy) {
    return false;
  }

  if (!candidate.isAlive || !candidate.hasSpawned || candidate.isDisconnected) {
    return false;
  }

  if (
    !candidate.isFriendlyToMe ||
    candidate.isAlliedWithMe ||
    candidate.isOnSameTeamAsMe ||
    candidate.iEmbargoThem ||
    candidate.theyEmbargoMe ||
    candidate.iTargetThem ||
    candidate.theyTargetMe
  ) {
    return false;
  }

  if (
    diplomacy.outgoingAllianceRequestPlayerIds.includes(candidate.playerId) ||
    diplomacy.allyPlayerIds.includes(candidate.playerId)
  ) {
    return false;
  }

  // TODO: Incoming alliance requests are not exposed in the current observation.
  // Prefer handling explicit incoming requests before proactive requests later.
  return player.playerId !== candidate.playerId;
}

function chooseBestAttackTarget(
  player: NonNullable<Observation["ownPlayer"]>,
  targets: readonly ObservationDiplomacyPlayer[],
): ObservationDiplomacyPlayer {
  return [...targets].sort((left, right) => {
    const leftTroopRatio = player.troops / left.troops;
    const rightTroopRatio = player.troops / right.troops;
    if (rightTroopRatio !== leftTroopRatio) {
      return rightTroopRatio - leftTroopRatio;
    }

    const leftTileRatio = player.tilesOwned / left.tilesOwned;
    const rightTileRatio = player.tilesOwned / right.tilesOwned;
    if (rightTileRatio !== leftTileRatio) {
      return rightTileRatio - leftTileRatio;
    }

    if (left.tilesOwned !== right.tilesOwned) {
      return left.tilesOwned - right.tilesOwned;
    }

    if (left.troops !== right.troops) {
      return left.troops - right.troops;
    }

    return left.playerId.localeCompare(right.playerId);
  })[0];
}

function chooseBestAllianceCandidate(
  candidates: readonly ObservationDiplomacyPlayer[],
): ObservationDiplomacyPlayer {
  return [...candidates].sort((left, right) => {
    if (left.tilesOwned !== right.tilesOwned) {
      return right.tilesOwned - left.tilesOwned;
    }

    if (left.troops !== right.troops) {
      return right.troops - left.troops;
    }

    return left.playerId.localeCompare(right.playerId);
  })[0];
}

function chooseBestExpansionCandidate(
  frontiers: Observation["frontiers"],
) {
  if (!frontiers) {
    return null;
  }

  return [...frontiers.cheapExpansionCandidates].sort((left, right) => {
    if (right.supportCount !== left.supportCount) {
      return right.supportCount - left.supportCount;
    }

    return left.tile.tileRef - right.tile.tileRef;
  })[0] ?? null;
}

function createExpansionAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  tileRef: number,
): BaselineBotAction | null {
  if (isExpansionThrottled(openingState, observation.game.tick)) {
    return null;
  }

  const attackKey = `expansion:${tileRef}`;
  if (isOpeningAttackDebounced(openingState, observation.game.tick, attackKey)) {
    return null;
  }

  openingState.lastExpansionTick = observation.game.tick;
  openingState.consecutiveExpansionPushes += 1;
  rememberOpeningTarget(openingState, observation.game.tick, {
    kind: "expansion",
    playerId: null,
    tileRef,
  });

  return createAttackAction(attackKey, observation.game.tick, openingState, null);
}

function createHostileAttackAction(
  observation: Observation,
  openingState: BaselineOpeningState,
  playerId: string,
): BaselineBotAction | null {
  const attackKey = `hostile:${playerId}`;
  if (isOpeningAttackDebounced(openingState, observation.game.tick, attackKey)) {
    return null;
  }

  openingState.consecutiveExpansionPushes = 0;
  rememberOpeningTarget(openingState, observation.game.tick, {
    kind: "hostile",
    playerId,
    tileRef: null,
  });

  return createAttackAction(
    attackKey,
    observation.game.tick,
    openingState,
    playerId,
  );
}

function createAttackAction(
  attackKey: string,
  tick: number,
  openingState: BaselineOpeningState,
  targetPlayerId: string | null,
): BaselineBotAction {
  openingState.lastAttackKey = attackKey;
  openingState.lastAttackTick = tick;
  return {
    type: "attack_player",
    targetPlayerId,
    // Let the pinned game logic choose the default attack amount instead of
    // guessing a stronger split in the policy layer.
    troops: null,
  };
}

function getOpeningState(playerId: string): BaselineOpeningState {
  const existing = openingStateByPlayerId.get(playerId);
  if (existing) {
    return existing;
  }

  const created: BaselineOpeningState = {
    rememberedTarget: null,
    lastAttackKey: null,
    lastAttackTick: null,
    lastExpansionTick: null,
    consecutiveExpansionPushes: 0,
  };
  openingStateByPlayerId.set(playerId, created);
  return created;
}

function resetOpeningState(openingState: BaselineOpeningState): void {
  openingState.rememberedTarget = null;
  openingState.lastAttackKey = null;
  openingState.lastAttackTick = null;
  openingState.lastExpansionTick = null;
  openingState.consecutiveExpansionPushes = 0;
}

function rememberOpeningTarget(
  openingState: BaselineOpeningState,
  tick: number,
  target: Omit<NonNullable<BaselineOpeningState["rememberedTarget"]>, "expiresAtTick">,
): void {
  openingState.rememberedTarget = {
    ...target,
    expiresAtTick: tick + OPENING_TARGET_MEMORY_TICKS,
  };
}

function isOpeningAttackDebounced(
  openingState: BaselineOpeningState,
  tick: number,
  attackKey: string,
): boolean {
  return (
    openingState.lastAttackKey === attackKey &&
    openingState.lastAttackTick !== null &&
    tick - openingState.lastAttackTick < OPENING_ATTACK_DEBOUNCE_TICKS
  );
}

function isExpansionThrottled(
  openingState: BaselineOpeningState,
  tick: number,
): boolean {
  if (
    openingState.lastExpansionTick !== null &&
    tick - openingState.lastExpansionTick >= OPENING_EXPANSION_STREAK_RESET_TICKS
  ) {
    openingState.consecutiveExpansionPushes = 0;
  }

  if (
    openingState.lastExpansionTick !== null &&
    tick - openingState.lastExpansionTick < OPENING_EXPANSION_THROTTLE_TICKS
  ) {
    return true;
  }

  return (
    openingState.consecutiveExpansionPushes >=
    MAX_CONSECUTIVE_OPENING_EXPANSION_PUSHES
  );
}

function getSafeHostileTargets(
  observation: Observation,
): ObservationDiplomacyPlayer[] {
  const player = observation.ownPlayer;

  if (!player || !player.hasSpawned) {
    return [];
  }

  if (
    observation.game.session.spawnImmunityActive ||
    observation.game.session.nationSpawnImmunityActive
  ) {
    return [];
  }

  return getAdjacentHostileTargets(observation).filter((target) =>
    isClearlySafeAttackTarget(player, target),
  );
}

function findAdjacentHostileTarget(
  observation: Observation,
  playerId: string | null,
): ObservationDiplomacyPlayer | null {
  if (!playerId) {
    return null;
  }

  return (
    getAdjacentHostileTargets(observation).find(
      (target) => target.playerId === playerId,
    ) ??
    null
  );
}

function getAdjacentHostileTargets(
  observation: Observation,
): ObservationDiplomacyPlayer[] {
  const frontiers = observation.frontiers;
  const diplomacy = observation.diplomacy;

  if (!frontiers || !diplomacy || frontiers.ownBorderTileCount === null) {
    return [];
  }

  return getUniqueDiplomacyPlayers(
    diplomacy.players,
    frontiers.adjacentHostilePlayers.map((frontier) => frontier.playerId),
  );
}

function findExpansionCandidateByTileRef(
  observation: Observation,
  tileRef: number | null,
) {
  if (tileRef === null) {
    return null;
  }

  return (
    observation.frontiers?.cheapExpansionCandidates.find(
      (candidate) => candidate.tile.tileRef === tileRef,
    ) ?? null
  );
}

function shouldAvoidAggressiveOpeningAttack(
  observation: Observation,
  strategy: BaselineStrategyState,
): boolean {
  const player = observation.ownPlayer;
  const frontiers = observation.frontiers;
  if (!player || !frontiers) {
    return false;
  }

  if (
    strategy.frontierCombat.recommendedAttackPosture === "avoid" ||
    strategy.frontierCombat.recommendedAttackPosture === "hold"
  ) {
    return true;
  }

  if (
    strategy.frontierCombat.localThreatLevel.band === "high" ||
    strategy.frontierCombat.localThreatLevel.band === "very_high"
  ) {
    return true;
  }

  if (frontiers.adjacentHostilePlayers.length === 0) {
    return false;
  }

  const bestExpansionCandidate =
    strategy.frontierCombat.bestExpansionCandidate ??
    chooseBestExpansionCandidate(frontiers);
  if (
    player.troops < MIN_ATTACK_TROOPS ||
    !bestExpansionCandidate ||
    bestExpansionCandidate.supportCount < MIN_OPENING_SUPPORT
  ) {
    return true;
  }

  const strongestNearbyHostile = getStrongestNearbyHostile(observation);

  return (
    strongestNearbyHostile !== undefined &&
    !isClearlySafeAttackTarget(player, strongestNearbyHostile)
  );
}

function shouldUseOpeningExpansionPhase(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): boolean {
  if (shouldHoldDefensiveLine(observation, strategy)) {
    return false;
  }

  if (openingState.rememberedTarget !== null) {
    return true;
  }

  if (strategy.frontierCombat.recommendedAttackPosture === "avoid") {
    return false;
  }

  return (
    strategy.frontierCombat.bestExpansionCandidate !== null ||
    chooseBestExpansionCandidate(observation.frontiers) !== null
  );
}

function shouldHoldDefensiveLine(
  observation: Observation,
  strategy: BaselineStrategyState,
): boolean {
  const player = observation.ownPlayer;
  if (
    strategy.frontierCombat.recommendedAttackPosture === "hold" ||
    strategy.frontierCombat.recommendedAttackPosture === "avoid"
  ) {
    return true;
  }

  if (
    strategy.frontierCombat.localThreatLevel.band === "high" ||
    strategy.frontierCombat.localThreatLevel.band === "very_high"
  ) {
    return true;
  }

  const strongestNearbyHostile = getStrongestNearbyHostile(observation);
  if (!player || !strongestNearbyHostile) {
    return false;
  }

  return !isClearlySafeAttackTarget(player, strongestNearbyHostile);
}

function shouldStopAggressiveExpansion(
  observation: Observation,
  openingState: BaselineOpeningState,
  strategy: BaselineStrategyState,
): boolean {
  const player = observation.ownPlayer;
  const economy = observation.economy;
  const frontiers = observation.frontiers;
  if (!player || !frontiers) {
    return false;
  }

  if (
    strategy.frontierCombat.recommendedAttackPosture === "hold" ||
    strategy.frontierCombat.recommendedAttackPosture === "avoid"
  ) {
    return true;
  }

  if (
    strategy.frontierCombat.localThreatLevel.band === "high" ||
    strategy.frontierCombat.localThreatLevel.band === "very_high"
  ) {
    return true;
  }

  if (isExpansionThrottled(openingState, observation.game.tick)) {
    return true;
  }

  if (player.troops < MIN_EXPANSION_RESERVE_TROOPS) {
    return true;
  }

  if (
    economy?.maxTroops !== null &&
    economy?.maxTroops !== undefined &&
    economy.maxTroops > 0 &&
    economy.troops / economy.maxTroops < MIN_EXPANSION_TROOP_CAP_RATIO
  ) {
    return true;
  }

  if (frontiers.adjacentHostilePlayers.length === 0) {
    return false;
  }

  const strongestNearbyHostile = getStrongestNearbyHostile(observation);

  return (
    strongestNearbyHostile !== undefined &&
    !isClearlySafeAttackTarget(player, strongestNearbyHostile)
  );
}

function getStrongestNearbyHostile(
  observation: Observation,
): ObservationDiplomacyPlayer | undefined {
  return getAdjacentHostileTargets(observation).sort((left, right) => {
    if (right.troops !== left.troops) {
      return right.troops - left.troops;
    }

    if (right.tilesOwned !== left.tilesOwned) {
      return right.tilesOwned - left.tilesOwned;
    }

    return left.playerId.localeCompare(right.playerId);
  })[0];
}

function getUniqueDiplomacyPlayers(
  players: readonly ObservationDiplomacyPlayer[],
  playerIds: readonly string[],
): ObservationDiplomacyPlayer[] {
  const uniquePlayerIds = new Set(playerIds);
  return [...uniquePlayerIds]
    .map((playerId) => findDiplomacyPlayer(players, playerId))
    .filter((player): player is ObservationDiplomacyPlayer => player !== null);
}

function findDiplomacyPlayer(
  players: readonly ObservationDiplomacyPlayer[],
  playerId: string,
): ObservationDiplomacyPlayer | null {
  return players.find((player) => player.playerId === playerId) ?? null;
}

function parseObservationGold(value: string): bigint | null {
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function compareEconomyUpgradeCandidate(
  left: Observation["visibleStructures"][number],
  right: Observation["visibleStructures"][number],
): number {
  const leftTypePriority = getEconomyUpgradeTypePriority(left.type);
  const rightTypePriority = getEconomyUpgradeTypePriority(right.type);
  if (leftTypePriority !== rightTypePriority) {
    return leftTypePriority - rightTypePriority;
  }

  const leftLevel = left.level ?? Number.MAX_SAFE_INTEGER;
  const rightLevel = right.level ?? Number.MAX_SAFE_INTEGER;
  if (leftLevel !== rightLevel) {
    return leftLevel - rightLevel;
  }

  return left.id - right.id;
}

function getEconomyUpgradeTypePriority(type: string): number {
  const index = ECONOMY_UPGRADE_TYPE_PREFERENCE.indexOf(
    type as (typeof ECONOMY_UPGRADE_TYPE_PREFERENCE)[number],
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
