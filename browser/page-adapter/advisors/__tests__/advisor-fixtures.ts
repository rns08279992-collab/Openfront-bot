import type { Observation, ObservationDiplomacyPlayer } from "../../ObservationAdapter";
import type { StrategyState } from "../../../../shared/interpreter/strategy-state";

type StrategyBand = StrategyState["frontierCombat"]["localThreatLevel"]["band"];
type RecommendedAttackPosture =
  StrategyState["frontierCombat"]["recommendedAttackPosture"];

export function makeTile(tileRef: number, x = tileRef, y = 0) {
  return { tileRef, x, y };
}

export function makeDiplomacyPlayer(
  playerId: string,
  overrides: Partial<ObservationDiplomacyPlayer> = {},
): ObservationDiplomacyPlayer {
  return {
    playerId,
    smallID: 2,
    displayName: `Player ${playerId}`,
    playerType: "HUMAN",
    team: null,
    isAlive: true,
    isDisconnected: false,
    hasSpawned: true,
    tilesOwned: 12,
    troops: 600,
    gold: "2500",
    isAlliedWithMe: false,
    isOnSameTeamAsMe: false,
    isFriendlyToMe: false,
    iEmbargoThem: false,
    theyEmbargoMe: false,
    iTargetThem: false,
    theyTargetMe: false,
    ...overrides,
  };
}

export function makeObservation(
  overrides: {
    ownPlayer?: Observation["ownPlayer"];
    economy?: Observation["economy"];
    frontiers?: Observation["frontiers"];
    diplomacy?: Observation["diplomacy"];
    visibleUnits?: Observation["visibleUnits"];
    visibleStructures?: Observation["visibleStructures"];
    spawnImmunityActive?: boolean;
    nationSpawnImmunityActive?: boolean;
  } = {},
): Observation {
  return {
    source: {
      adapterVersion: 3,
      pinnedCommit: "52033597efb09de6c8d724f6e2784c3c9e8a7511",
      capturedAtIso: "2026-05-02T00:00:00.000Z",
    },
    game: {
      gameID: "game-1",
      tick: 100,
      phase: "active",
      map: {
        width: 20,
        height: 20,
        landTileCount: 400,
        gameMap: "Test Map",
        gameMapSize: "Normal",
      },
      session: {
        myClientID: "OWN00001",
        difficulty: "Medium",
        gameType: "Private",
        gameMode: "Free For All",
        rankedType: null,
        playerCount: 2,
        humanPlayerCount: 2,
        botPlayerCount: 0,
        nationPlayerCount: 0,
        spawnImmunityActive: overrides.spawnImmunityActive ?? false,
        nationSpawnImmunityActive: overrides.nationSpawnImmunityActive ?? false,
        paused: null,
      },
    },
    ownPlayer: {
      playerId: "OWN00001",
      clientID: "OWN00001",
      smallID: 1,
      name: "Me",
      displayName: "Me",
      playerType: "HUMAN",
      team: null,
      isAlive: true,
      hasSpawned: true,
      isDisconnected: false,
      isTraitor: false,
      traitorRemainingTicks: null,
      isLobbyCreator: true,
      tilesOwned: 10,
      troops: 1000,
      gold: "5000",
    },
    economy: {
      gold: "5000",
      troops: 1000,
      maxTroops: 1500,
      passiveGoldPerTick: "25",
      troopIncreasePerTick: 12,
      ownedUnitCounts: [],
    },
    configSnapshot: {
      rawGameConfig: {
        gameMap: "Test Map",
        difficulty: "Medium",
        gameType: "Private",
        gameMode: "Free For All",
        rankedType: null,
        gameMapSize: "Normal",
        publicGameModifiers: null,
        nations: null,
        bots: 0,
        infiniteGold: false,
        donateGold: true,
        infiniteTroops: false,
        donateTroops: true,
        instantBuild: false,
        disableNavMesh: false,
        disableAlliances: false,
        waterNukes: false,
        randomSpawn: false,
        maxPlayers: 8,
        maxTimerValueMinutes: null,
        spawnImmunityDurationTicks: 0,
        disabledUnits: [],
        playerTeams: null,
        goldMultiplier: 1,
        startingGold: 5000,
        hostCheats: null,
      },
      resolved: {
        numSpawnPhaseTurns: 0,
        spawnImmunityDurationTicks: 0,
        nationSpawnImmunityDurationTicks: null,
        disableAlliances: false,
        waterNukes: false,
        randomSpawn: false,
        hasExtendedSpawnImmunity: false,
        replayMode: false,
      },
    },
    spawn: {
      candidatesAvailable: false,
      legalTileRefs: null,
      legalTiles: null,
      candidateCount: null,
      firstLegalTileRef: null,
      actionable: false,
      blockedReason: "player_already_spawned",
    },
    frontiers: {
      ownBorderTileRefs: [9, 10],
      ownBorderTileCount: 2,
      adjacentPlayerIds: [],
      adjacentFriendlyPlayerIds: [],
      adjacentHostilePlayerIds: [],
      adjacentFriendlyPlayers: [],
      adjacentHostilePlayers: [],
      nearbyFrontierTileRefs: [],
      nearbyFrontierTiles: [],
      cheapExpansionCandidates: [],
    },
    boatTargets: [],
    diplomacy: {
      allyPlayerIds: [],
      targetPlayerIds: [],
      outgoingAllianceRequestPlayerIds: [],
      embargoedPlayerIds: [],
      embargoedByPlayerIds: [],
      activeAlliances: [],
      players: [],
    },
    visibleUnits: [],
    visibleStructures: [],
    ...overrides,
  };
}

export function makeStrategyState(
  overrides: {
    localThreatBand?: StrategyBand;
    localThreatScore?: number | null;
    localThreatReason?: string;
    overextensionRiskScore?: number | null;
    safeAttackWindowActive?: boolean;
    safeAttackWindowScore?: number | null;
    safeAttackWindowReason?: string;
    recommendedAttackPosture?: RecommendedAttackPosture;
  } = {},
): StrategyState {
  const localThreatBand = overrides.localThreatBand ?? "low";
  const localThreatScore = overrides.localThreatScore ?? 20;
  const localThreatReason =
    overrides.localThreatReason ?? "Fixture local threat level.";
  const overextensionRiskScore = overrides.overextensionRiskScore ?? 35;
  const safeAttackWindowActive = overrides.safeAttackWindowActive ?? true;
  const safeAttackWindowScore = overrides.safeAttackWindowScore ?? 70;
  const safeAttackWindowReason =
    overrides.safeAttackWindowReason ?? "Fixture safe attack window.";

  return {
    spawnOpening: {
      legalSpawnQuality: { score: 50, band: "medium", reason: "fixture" },
      recommendedSpawn: null,
      connectedNeutralLandPotential: {
        score: 50,
        band: "medium",
        reason: "fixture",
      },
      coastlinePortPotential: { score: 50, band: "medium", reason: "fixture" },
      nearestPlayerPressure: { score: 50, band: "medium", reason: "fixture" },
      defendableFlanksChokepointQuality: {
        score: 50,
        band: "medium",
        reason: "fixture",
      },
      earlyEnclosurePotential: { score: 50, band: "medium", reason: "fixture" },
    },
    growthEconomy: {
      growthHealth: { score: 50, band: "medium", reason: "fixture" },
      reserveHealth: { score: 50, band: "medium", reason: "fixture" },
      nearCapPressure: { score: 50, urgency: "medium", reason: "fixture" },
      workerEconomyHealth: { score: 50, band: "medium", reason: "fixture" },
      cityOpportunity: { score: 50, band: "medium", reason: "fixture" },
      portOpportunity: { score: 50, band: "medium", reason: "fixture" },
      tradePotential: { score: 50, band: "medium", reason: "fixture" },
    },
    frontierCombat: {
      bestExpansionCandidate: null,
      enclosureOpportunity: { score: 50, band: "medium", reason: "fixture" },
      localThreatLevel: {
        score: localThreatScore,
        band: localThreatBand,
        reason: localThreatReason,
      },
      strongestAdjacentHostile: null,
      localFriendlySupport: { score: 50, band: "medium", reason: "fixture" },
      contestedBorder: { active: false, reason: "fixture" },
      overextensionRisk: {
        score: overextensionRiskScore,
        band: "medium",
        reason: "fixture",
      },
      safeAttackWindow: {
        active: safeAttackWindowActive,
        score: safeAttackWindowScore,
        reason: safeAttackWindowReason,
      },
      recommendedAttackPosture: overrides.recommendedAttackPosture ?? "expand",
    },
    buildDefend: {
      defensePostOpportunity: { score: 50, band: "medium", reason: "fixture" },
      citySafetyScore: { score: 50, band: "medium", reason: "fixture" },
      borderFortificationUrgency: {
        score: 50,
        urgency: "medium",
        reason: "fixture",
      },
      coastalExposureRisk: { score: 50, band: "medium", reason: "fixture" },
    },
    navalTrade: {
      coastlineAccess: { score: 50, band: "medium", reason: "fixture" },
      tradeRouteValue: { score: 50, band: "medium", reason: "fixture" },
      piracyRisk: { score: 50, band: "medium", reason: "fixture" },
      enemyPortHarassOpportunity: {
        score: 50,
        band: "medium",
        reason: "fixture",
      },
    },
    nukeSam: {
      highValueClusterScore: { score: 50, band: "medium", reason: "fixture" },
      samCoverageRisk: { score: 50, band: "medium", reason: "fixture" },
      siloOpportunity: { score: 50, band: "medium", reason: "fixture" },
      nukeVulnerability: { score: 50, band: "medium", reason: "fixture" },
    },
    diplomacy: {
      adjacentFriendlyValue: { score: 50, band: "medium", reason: "fixture" },
      allianceBufferValue: { score: 50, band: "medium", reason: "fixture" },
      allianceTradeUpside: { score: 50, band: "medium", reason: "fixture" },
      betrayalRisk: { score: 50, band: "medium", reason: "fixture" },
      isolationRisk: { score: 50, band: "medium", reason: "fixture" },
    },
  };
}
