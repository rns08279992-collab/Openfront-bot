import type {
  Observation,
  ObservationDiplomacyPlayer,
  ObservationEconomyState,
  ObservationTilePosition,
  ObservationVisibleEntity,
} from "../../browser/page-adapter/ObservationAdapter";

type StrategyBand =
  | "unknown"
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

type UrgencyLevel = "unknown" | "low" | "medium" | "high" | "critical";
type RecommendedAttackPosture = "expand" | "hold" | "poke" | "avoid";

export interface StrategyScoreSignal {
  score: number | null;
  band: StrategyBand;
  reason: string;
}

export interface StrategyUrgencySignal {
  score: number | null;
  urgency: UrgencyLevel;
  reason: string;
}

export interface StrategyPlayerPressure {
  playerId: string;
  displayName: string;
  tilesOwned: number;
  troops: number;
  pressureScore: number;
}

export interface StrategyExpansionTarget {
  tile: ObservationTilePosition;
  score: number;
  supportCount: number;
  reason: string;
}

export interface StrategySpawnRecommendation {
  tile: ObservationTilePosition;
  score: number;
  reason: string;
}

export interface StrategySpawnOpeningState {
  legalSpawnQuality: StrategyScoreSignal;
  recommendedSpawn: StrategySpawnRecommendation | null;
  connectedNeutralLandPotential: StrategyScoreSignal;
  coastlinePortPotential: StrategyScoreSignal;
  nearestPlayerPressure: StrategyScoreSignal;
  defendableFlanksChokepointQuality: StrategyScoreSignal;
  earlyEnclosurePotential: StrategyScoreSignal;
}

export interface StrategyGrowthEconomyState {
  growthHealth: StrategyScoreSignal;
  reserveHealth: StrategyScoreSignal;
  nearCapPressure: StrategyUrgencySignal;
  workerEconomyHealth: StrategyScoreSignal;
  cityOpportunity: StrategyScoreSignal;
  portOpportunity: StrategyScoreSignal;
  tradePotential: StrategyScoreSignal;
}

export interface StrategyFrontierCombatState {
  bestExpansionCandidate: StrategyExpansionTarget | null;
  enclosureOpportunity: StrategyScoreSignal;
  localThreatLevel: StrategyScoreSignal;
  strongestAdjacentHostile: StrategyPlayerPressure | null;
  localFriendlySupport: StrategyScoreSignal;
  contestedBorder: {
    active: boolean;
    reason: string;
  };
  overextensionRisk: StrategyScoreSignal;
  safeAttackWindow: {
    active: boolean;
    score: number | null;
    reason: string;
  };
  recommendedAttackPosture: RecommendedAttackPosture;
}

export interface StrategyBuildDefendState {
  defensePostOpportunity: StrategyScoreSignal;
  citySafetyScore: StrategyScoreSignal;
  borderFortificationUrgency: StrategyUrgencySignal;
  coastalExposureRisk: StrategyScoreSignal;
}

export interface StrategyNavalTradeState {
  coastlineAccess: StrategyScoreSignal;
  tradeRouteValue: StrategyScoreSignal;
  piracyRisk: StrategyScoreSignal;
  enemyPortHarassOpportunity: StrategyScoreSignal;
}

export interface StrategyNukeSamState {
  highValueClusterScore: StrategyScoreSignal;
  samCoverageRisk: StrategyScoreSignal;
  siloOpportunity: StrategyScoreSignal;
  nukeVulnerability: StrategyScoreSignal;
}

export interface StrategyDiplomacyState {
  adjacentFriendlyValue: StrategyScoreSignal;
  allianceBufferValue: StrategyScoreSignal;
  allianceTradeUpside: StrategyScoreSignal;
  betrayalRisk: StrategyScoreSignal;
  isolationRisk: StrategyScoreSignal;
}

export interface StrategyState {
  spawnOpening: StrategySpawnOpeningState;
  growthEconomy: StrategyGrowthEconomyState;
  frontierCombat: StrategyFrontierCombatState;
  buildDefend: StrategyBuildDefendState;
  navalTrade: StrategyNavalTradeState;
  nukeSam: StrategyNukeSamState;
  diplomacy: StrategyDiplomacyState;
}

const DEFENSE_POST_RANGE_TILES = 30;
const RADIUS_PORT_SPAWN_TILES = 20;
const MAX_SAM_RANGE_TILES = 150;
const HYDROGEN_OUTER_RADIUS_TILES = 100;
const SILO_COST_GOLD = 1_000_000n;

export function interpretObservation(observation: Observation): StrategyState {
  const disabledUnits = new Set(observation.configSnapshot.rawGameConfig.disabledUnits);
  const ownPlayer = observation.ownPlayer;
  const economy = observation.economy;
  const diplomacy = observation.diplomacy;
  const ownStructures = observation.visibleStructures.filter(
    (entity) => entity.ownerPlayerId === ownPlayer?.playerId,
  );
  const hostilePlayers = getHostilePlayers(observation);
  const adjacentHostiles = getAdjacentPlayers(observation, "hostile");
  const adjacentFriendlies = getAdjacentPlayers(observation, "friendly");
  const strongestAdjacentHostile = rankHostiles(ownPlayer, adjacentHostiles)[0] ?? null;
  const bestExpansionCandidate = chooseBestExpansionCandidate(
    observation,
    strongestAdjacentHostile,
  );
  const ownPorts = ownStructures.filter((entity) => entity.type === "Port");
  const ownDefensePosts = ownStructures.filter(
    (entity) => entity.type === "Defense Post",
  );
  const ownSams = ownStructures.filter((entity) => entity.type === "SAM Launcher");
  const ownCities = ownStructures.filter((entity) => entity.type === "City");
  const ownFactories = ownStructures.filter((entity) => entity.type === "Factory");
  const hostileStructures = observation.visibleStructures.filter((entity) =>
    hostilePlayers.some((player) => player.playerId === entity.ownerPlayerId),
  );
  const hostileUnits = observation.visibleUnits.filter((entity) =>
    hostilePlayers.some((player) => player.playerId === entity.ownerPlayerId),
  );
  const hostilePorts = hostileStructures.filter((entity) => entity.type === "Port");
  const hostileWarships = hostileUnits.filter((entity) => entity.type === "Warship");
  const hostileSams = hostileStructures.filter(
    (entity) =>
      entity.type === "SAM Launcher" &&
      entity.level !== null &&
      !entity.isUnderConstruction,
  );

  const localThreatScore = scoreLocalThreat(observation, strongestAdjacentHostile);
  const localFriendlySupportScore = scoreLocalFriendlySupport(
    adjacentFriendlies,
    diplomacy,
  );
  const overextensionRisk = scoreOverextensionRisk(
    observation,
    strongestAdjacentHostile,
  );
  const safeAttackWindow = evaluateSafeAttackWindow(
    observation,
    strongestAdjacentHostile,
    overextensionRisk.score,
  );
  const recommendedAttackPosture = chooseRecommendedAttackPosture(
    observation,
    bestExpansionCandidate,
    localThreatScore.score,
    safeAttackWindow.active,
    overextensionRisk.score,
  );
  const citySafetyScore = scoreCitySafety(
    ownCities,
    ownFactories,
    ownPorts,
    hostileStructures,
    hostileUnits,
    ownDefensePosts.length,
  );
  const coastalExposureRisk = scoreCoastalExposureRisk(
    ownPorts,
    hostileWarships,
    hostilePorts,
  );
  const tradePotential = scoreTradePotential(
    observation,
    ownPorts.length,
    adjacentFriendlies.length,
  );
  const highValueClusterScore = scoreHostileCluster(hostileStructures, hostileUnits);
  const samCoverageRisk = scoreSamCoverageRisk(hostileStructures, hostileSams);
  const nukeVulnerability = scoreOwnNukeVulnerability(
    ownCities,
    ownFactories,
    ownPorts,
    ownSams,
  );
  const contestedBorderActive =
    adjacentHostiles.length > 0 &&
    (adjacentFriendlies.length > 0 ||
      (observation.frontiers?.cheapExpansionCandidates.length ?? 0) > 0);
  const alliancesDisabled = observation.configSnapshot.resolved.disableAlliances;
  const portsDisabled =
    observation.configSnapshot.rawGameConfig.publicGameModifiers?.isPortsDisabled ===
      true || disabledUnits.has("Port");
  const nukesDisabled =
    observation.configSnapshot.rawGameConfig.publicGameModifiers?.isNukesDisabled ===
      true ||
    disabledUnits.has("Missile Silo") ||
    disabledUnits.has("Atom Bomb") ||
    disabledUnits.has("Hydrogen Bomb") ||
    disabledUnits.has("MIRV");

  return {
    spawnOpening: {
      legalSpawnQuality: scoreLegalSpawnQuality(observation),
      recommendedSpawn: chooseRecommendedSpawn(observation),
      connectedNeutralLandPotential: scoreConnectedNeutralLandPotential(
        observation,
        bestExpansionCandidate,
      ),
      coastlinePortPotential: portsDisabled
        ? makeScore(0, "Ports are disabled in this lobby.")
        : ownPorts.length > 0
          ? makeScore(80, "Existing ports confirm live coastline access.")
          : makeUnknownScore(
              "The current observation does not expose full land-water topology, so coastline potential stays heuristic until map terrain is surfaced.",
            ),
      nearestPlayerPressure: ownPlayer?.hasSpawned
        ? localThreatScore
        : scoreSpawnPressure(observation),
      defendableFlanksChokepointQuality: scoreDefendableFlanks(
        observation,
        localThreatScore.score,
      ),
      earlyEnclosurePotential: scoreEarlyEnclosurePotential(
        bestExpansionCandidate,
        localThreatScore.score,
      ),
    },
    growthEconomy: {
      growthHealth: scoreGrowthHealth(economy),
      reserveHealth: scoreReserveHealth(ownPlayer, economy),
      nearCapPressure: scoreNearCapPressure(economy),
      workerEconomyHealth: scoreWorkerEconomyHealth(
        economy,
        ownFactories.length,
        ownCities.length,
      ),
      cityOpportunity: scoreCityOpportunity(observation, ownCities.length),
      portOpportunity: portsDisabled
        ? makeScore(0, "Ports are disabled in this lobby.")
        : scorePortOpportunity(observation, ownPorts.length, tradePotential.score),
      tradePotential,
    },
    frontierCombat: {
      bestExpansionCandidate,
      enclosureOpportunity: scoreEnclosureOpportunity(
        observation,
        bestExpansionCandidate,
        localThreatScore.score,
      ),
      localThreatLevel: localThreatScore,
      strongestAdjacentHostile,
      localFriendlySupport: localFriendlySupportScore,
      contestedBorder: {
        active: contestedBorderActive,
        reason:
          adjacentHostiles.length === 0
            ? "No adjacent hostiles are currently confirmed."
            : adjacentFriendlies.length > 0
              ? "Friendly and hostile borders are both adjacent, so local control is shared."
              : "Hostiles are adjacent and neutral frontier tiles are still available.",
      },
      overextensionRisk,
      safeAttackWindow,
      recommendedAttackPosture,
    },
    buildDefend: {
      defensePostOpportunity: scoreDefensePostOpportunity(
        observation,
        ownDefensePosts.length,
        localThreatScore.score,
      ),
      citySafetyScore,
      borderFortificationUrgency: scoreBorderFortificationUrgency(
        observation,
        ownDefensePosts.length,
        citySafetyScore.score,
        localThreatScore.score,
      ),
      coastalExposureRisk,
    },
    navalTrade: {
      coastlineAccess: portsDisabled
        ? makeScore(0, "Ports are disabled in this lobby.")
        : ownPorts.length > 0
          ? makeScore(85, "Existing ports confirm active coastline access.")
          : makeScore(
              tradePotential.score ?? 20,
              "No port is confirmed yet, so coastline access remains inferred from current naval and trade opportunities.",
            ),
      tradeRouteValue: scoreTradeRouteValue(
        tradePotential.score,
        ownPorts.length,
        adjacentFriendlies.length,
      ),
      piracyRisk: scorePiracyRisk(ownPorts, hostileWarships),
      enemyPortHarassOpportunity: scoreEnemyPortHarassOpportunity(
        hostilePorts,
        ownPorts,
        hostileWarships.length,
        safeAttackWindow.active,
      ),
    },
    nukeSam: {
      highValueClusterScore,
      samCoverageRisk,
      siloOpportunity: nukesDisabled
        ? makeScore(0, "Nukes are disabled in this lobby.")
        : scoreSiloOpportunity(
            economy,
            highValueClusterScore.score,
            samCoverageRisk.score,
          ),
      nukeVulnerability,
    },
    diplomacy: {
      adjacentFriendlyValue: scoreAdjacentFriendlyValue(adjacentFriendlies, diplomacy),
      allianceBufferValue: alliancesDisabled
        ? makeScore(0, "Alliances are disabled in this lobby.")
        : scoreAllianceBufferValue(adjacentFriendlies.length, adjacentHostiles.length),
      allianceTradeUpside: alliancesDisabled
        ? makeScore(0, "Alliances are disabled in this lobby.")
        : scoreAllianceTradeUpside(
            adjacentFriendlies.length,
            ownPorts.length,
            tradePotential.score,
          ),
      betrayalRisk: scoreBetrayalRisk(ownPlayer, adjacentFriendlies),
      isolationRisk: scoreIsolationRisk(
        diplomacy,
        adjacentFriendlies.length,
        adjacentHostiles.length,
        ownPorts.length,
      ),
    },
  };
}

function scoreLegalSpawnQuality(observation: Observation): StrategyScoreSignal {
  const recommendedSpawn = chooseRecommendedSpawn(observation);
  if (!observation.spawn.actionable || !recommendedSpawn) {
    return makeUnknownScore(
      observation.spawn.blockedReason
        ? `Spawn is not actionable: ${observation.spawn.blockedReason}.`
        : "No legal spawn tile is currently available.",
    );
  }

  const candidateCount = observation.spawn.candidateCount ?? 0;
  const landTiles = observation.game.map.landTileCount ?? candidateCount;
  const densityScore =
    landTiles > 0 ? clamp((candidateCount / landTiles) * 100, 0, 100) : 50;
  const score = clamp(recommendedSpawn.score * 0.7 + densityScore * 0.3, 0, 100);
  return makeScore(
    score,
    `The recommended spawn has ${recommendedSpawn.reason.toLowerCase()} and ${candidateCount} legal choices remain.`,
  );
}

function chooseRecommendedSpawn(
  observation: Observation,
): StrategySpawnRecommendation | null {
  const legalTiles = observation.spawn.legalTiles;
  if (!observation.spawn.actionable || !legalTiles || legalTiles.length === 0) {
    return null;
  }

  const centerX = (observation.game.map.width - 1) / 2;
  const centerY = (observation.game.map.height - 1) / 2;
  const maxCenterDistance = Math.hypot(centerX, centerY) || 1;

  const ranked = legalTiles
    .map((tile) => {
      const centerDistance = Math.hypot(tile.x - centerX, tile.y - centerY);
      const centrality = 1 - centerDistance / maxCenterDistance;
      const edgeBuffer = normalizedEdgeBuffer(
        tile,
        observation.game.map.width,
        observation.game.map.height,
      );
      const score = clamp((centrality * 0.65 + edgeBuffer * 0.35) * 100, 0, 100);
      return {
        tile,
        score,
        reason: `a ${describeBand(scoreToBand(score))} balance of central reach and edge buffer`,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (left.tile.y !== right.tile.y) {
        return left.tile.y - right.tile.y;
      }
      return left.tile.x - right.tile.x;
    });

  return ranked[0] ?? null;
}

function scoreConnectedNeutralLandPotential(
  observation: Observation,
  bestExpansionCandidate: StrategyExpansionTarget | null,
): StrategyScoreSignal {
  const frontiers = observation.frontiers;
  if (!observation.ownPlayer?.hasSpawned) {
    const candidateCount = observation.spawn.candidateCount ?? 0;
    const score = clamp(candidateCount / 4, 0, 75);
    return makeScore(
      score,
      "Before spawn, neutral-land potential is approximated from how many legal centers are still available.",
    );
  }

  if (!frontiers) {
    return makeUnknownScore("Frontier data is unavailable.");
  }

  const neutralFrontierCount = frontiers.nearbyFrontierTileRefs.length;
  const supportBoost = bestExpansionCandidate?.supportCount ?? 0;
  const score = clamp(neutralFrontierCount * 3 + supportBoost * 12, 0, 100);
  return makeScore(
    score,
    `${neutralFrontierCount} nearby neutral frontier tiles and ${supportBoost} support on the best candidate indicate current neutral growth headroom.`,
  );
}

function scoreSpawnPressure(observation: Observation): StrategyScoreSignal {
  const candidateCount = observation.spawn.candidateCount;
  if (candidateCount === null) {
    return makeUnknownScore("Manual spawn pressure is not observable in the current phase.");
  }

  const score = clamp(100 - candidateCount / 2, 0, 100);
  return makeScore(
    score,
    `${candidateCount} legal spawn tiles remain; fewer legal centers usually means tighter opening pressure.`,
  );
}

function scoreDefendableFlanks(
  observation: Observation,
  localThreatScore: number | null,
): StrategyScoreSignal {
  const frontiers = observation.frontiers;
  if (!observation.ownPlayer?.hasSpawned) {
    const spawn = chooseRecommendedSpawn(observation);
    if (!spawn) {
      return makeUnknownScore("Spawn is not actionable.");
    }
    const edgeBuffer =
      normalizedEdgeBuffer(
        spawn.tile,
        observation.game.map.width,
        observation.game.map.height,
      ) * 100;
    return makeScore(
      edgeBuffer,
      "Before spawn, flank quality is estimated from how much map-edge buffer the recommended tile preserves.",
    );
  }

  if (!frontiers || !observation.ownPlayer) {
    return makeUnknownScore("Frontier data is unavailable.");
  }

  const borderRatio =
    observation.ownPlayer.tilesOwned > 0 && frontiers.ownBorderTileCount !== null
      ? frontiers.ownBorderTileCount / observation.ownPlayer.tilesOwned
      : null;
  if (borderRatio === null) {
    return makeUnknownScore("Own border ratio is unavailable.");
  }

  const threatPenalty = (localThreatScore ?? 40) * 0.3;
  const score = clamp(100 - borderRatio * 250 - threatPenalty, 0, 100);
  return makeScore(
    score,
    `Border density is ${borderRatio.toFixed(3)} of owned land; lower exposed perimeter is treated as more defendable.`,
  );
}

function scoreEarlyEnclosurePotential(
  bestExpansionCandidate: StrategyExpansionTarget | null,
  localThreatScore: number | null,
): StrategyScoreSignal {
  if (!bestExpansionCandidate) {
    return makeScore(0, "No cheap expansion candidate is currently confirmed.");
  }

  const threatPenalty = (localThreatScore ?? 40) * 0.35;
  const score = clamp(bestExpansionCandidate.score - threatPenalty * 0.5, 0, 100);
  return makeScore(
    score,
    `The best expansion candidate has ${bestExpansionCandidate.supportCount} adjacent supports, discounted by nearby threat.`,
  );
}

function scoreGrowthHealth(economy: ObservationEconomyState | null): StrategyScoreSignal {
  if (!economy || economy.maxTroops === null || economy.maxTroops <= 0) {
    return makeUnknownScore("Growth health needs troop-cap data.");
  }

  const fillRatio = economy.troops / economy.maxTroops;
  const growthRate = economy.troopIncreasePerTick ?? 0;
  const normalizedGrowth = clamp(growthRate / 2_500, 0, 1);
  const score = clamp((1 - fillRatio) * 60 + normalizedGrowth * 40, 0, 100);
  return makeScore(
    score,
    `Troop fill ratio is ${(fillRatio * 100).toFixed(1)}% with ${growthRate.toFixed(1)} troops per tick.`,
  );
}

function scoreReserveHealth(
  ownPlayer: Observation["ownPlayer"],
  economy: ObservationEconomyState | null,
): StrategyScoreSignal {
  if (!ownPlayer || !economy) {
    return makeUnknownScore("Reserve health needs own-player and economy state.");
  }

  const gold = parseGold(ownPlayer.gold);
  const troopCapRatio =
    economy.maxTroops && economy.maxTroops > 0 ? economy.troops / economy.maxTroops : 0.5;
  const troopScore = clamp(troopCapRatio * 60, 0, 60);
  const goldScore =
    gold === null ? 15 : clamp(Number(gold > 5_000_000n ? 40 : gold / 125_000n), 0, 40);
  return makeScore(
    troopScore + goldScore,
    `Reserve health combines current troop reserve with ${gold === null ? "unparseable" : gold.toString()} gold on hand.`,
  );
}

function scoreNearCapPressure(
  economy: ObservationEconomyState | null,
): StrategyUrgencySignal {
  if (!economy || economy.maxTroops === null || economy.maxTroops <= 0) {
    return makeUrgency(null, "unknown", "Near-cap pressure needs troop-cap data.");
  }

  const ratio = economy.troops / economy.maxTroops;
  return makeUrgency(
    clamp(ratio * 100, 0, 100),
    ratio >= 0.9
      ? "critical"
      : ratio >= 0.8
        ? "high"
        : ratio >= 0.65
          ? "medium"
          : "low",
    `Current troops are ${(ratio * 100).toFixed(1)}% of the observed troop cap.`,
  );
}

function scoreWorkerEconomyHealth(
  economy: ObservationEconomyState | null,
  factoryCount: number,
  cityCount: number,
): StrategyScoreSignal {
  if (!economy) {
    return makeUnknownScore("Economy state is unavailable.");
  }

  const passiveGold = parseGold(economy.passiveGoldPerTick ?? "0") ?? 0n;
  const structureValue = clamp(factoryCount * 18 + cityCount * 10, 0, 70);
  const passiveValue = clamp(Number(passiveGold / 10n), 0, 30);
  return makeScore(
    structureValue + passiveValue,
    `${factoryCount} factories, ${cityCount} cities, and ${passiveGold.toString()} passive gold per tick define the current worker economy base.`,
  );
}

function scoreCityOpportunity(
  observation: Observation,
  cityCount: number,
): StrategyScoreSignal {
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return makeUnknownScore("Own-player state is unavailable.");
  }

  const gold = parseGold(ownPlayer.gold);
  const tilesPerCity =
    cityCount > 0 ? ownPlayer.tilesOwned / cityCount : ownPlayer.tilesOwned;
  const economySlack =
    gold === null ? 25 : clamp(Number(gold > 1_000_000n ? 40 : gold / 25_000n), 0, 40);
  const landNeed = clamp(tilesPerCity / 4, 0, 60);
  return makeScore(
    economySlack + landNeed,
    `${cityCount} cities currently cover ${ownPlayer.tilesOwned} owned tiles.`,
  );
}

function scorePortOpportunity(
  observation: Observation,
  ownPortCount: number,
  tradePotentialScore: number | null,
): StrategyScoreSignal {
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return makeUnknownScore("Own-player state is unavailable.");
  }

  const gold = parseGold(ownPlayer.gold);
  const noPortBoost = ownPortCount === 0 ? 35 : Math.max(0, 20 - ownPortCount * 8);
  const goldScore =
    gold === null ? 15 : clamp(Number(gold > 500_000n ? 25 : gold / 20_000n), 0, 25);
  const tradeBoost = (tradePotentialScore ?? 25) * 0.4;
  return makeScore(
    clamp(noPortBoost + goldScore + tradeBoost, 0, 100),
    ownPortCount === 0
      ? "No owned port is confirmed yet, so trade and naval access still need enabling."
      : `${ownPortCount} owned ports already exist, so further ports are incremental rather than foundational.`,
  );
}

function scoreTradePotential(
  observation: Observation,
  ownPortCount: number,
  adjacentFriendlyCount: number,
): StrategyScoreSignal {
  const portsDisabled =
    observation.configSnapshot.rawGameConfig.publicGameModifiers?.isPortsDisabled ===
    true;
  if (portsDisabled) {
    return makeScore(0, "Ports are disabled in this lobby.");
  }

  const diplomacy = observation.diplomacy;
  const allyCount = diplomacy?.allyPlayerIds.length ?? 0;
  const score = clamp(
    ownPortCount * 25 + adjacentFriendlyCount * 12 + allyCount * 10,
    0,
    100,
  );
  return makeScore(
    score,
    `${ownPortCount} owned ports, ${adjacentFriendlyCount} adjacent friendlies, and ${allyCount} allies define current trade potential.`,
  );
}

function chooseBestExpansionCandidate(
  observation: Observation,
  strongestAdjacentHostile: StrategyPlayerPressure | null,
): StrategyExpansionTarget | null {
  const candidates = observation.frontiers?.cheapExpansionCandidates;
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const hostilePenalty = clamp((strongestAdjacentHostile?.pressureScore ?? 0) * 0.4, 0, 40);
  const ranked = candidates
    .map((candidate) => {
      const score = clamp(candidate.supportCount * 24 - hostilePenalty, 0, 100);
      return {
        tile: candidate.tile,
        score,
        supportCount: candidate.supportCount,
        reason: `${candidate.supportCount} supporting border tiles with current hostile pressure discounted.`,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.tile.tileRef - right.tile.tileRef;
    });

  return ranked[0] ?? null;
}

function scoreEnclosureOpportunity(
  observation: Observation,
  bestExpansionCandidate: StrategyExpansionTarget | null,
  localThreatScore: number | null,
): StrategyScoreSignal {
  const frontierCount = observation.frontiers?.cheapExpansionCandidates.length ?? 0;
  if (!bestExpansionCandidate || frontierCount === 0) {
    return makeScore(0, "No cheap frontier pocket is currently confirmed.");
  }

  const score = clamp(
    bestExpansionCandidate.score * 0.7 +
      frontierCount * 4 -
      (localThreatScore ?? 40) * 0.2,
    0,
    100,
  );
  return makeScore(
    score,
    `${frontierCount} cheap expansion tiles remain, led by a ${bestExpansionCandidate.supportCount}-support candidate.`,
  );
}

function scoreLocalThreat(
  observation: Observation,
  strongestAdjacentHostile: StrategyPlayerPressure | null,
): StrategyScoreSignal {
  const frontiers = observation.frontiers;
  if (!frontiers || !observation.ownPlayer) {
    return makeUnknownScore("Local threat needs own frontier data.");
  }

  const hostileCount = frontiers.adjacentHostilePlayers.length;
  if (hostileCount === 0) {
    return makeScore(5, "No adjacent hostile border is currently confirmed.");
  }

  const strongestScore = strongestAdjacentHostile?.pressureScore ?? 40;
  const score = clamp(strongestScore * 0.75 + hostileCount * 12, 0, 100);
  return makeScore(
    score,
    `${hostileCount} adjacent hostile frontiers are confirmed, led by ${strongestAdjacentHostile?.displayName ?? "an observed hostile"}.`,
  );
}

function scoreLocalFriendlySupport(
  adjacentFriendlies: ObservationDiplomacyPlayer[],
  diplomacy: Observation["diplomacy"],
): StrategyScoreSignal {
  const allyCount = diplomacy?.allyPlayerIds.length ?? 0;
  if (adjacentFriendlies.length === 0) {
    return makeScore(10, "No adjacent friendly border is currently confirmed.");
  }

  const friendlyStrength = adjacentFriendlies.reduce(
    (total, player) => total + player.troops,
    0,
  );
  const score = clamp(
    adjacentFriendlies.length * 18 + allyCount * 10 + friendlyStrength / 20_000,
    0,
    100,
  );
  return makeScore(
    score,
    `${adjacentFriendlies.length} adjacent friendlies contribute ${friendlyStrength} visible troop strength.`,
  );
}

function scoreOverextensionRisk(
  observation: Observation,
  strongestAdjacentHostile: StrategyPlayerPressure | null,
): StrategyScoreSignal {
  const ownPlayer = observation.ownPlayer;
  const frontiers = observation.frontiers;
  const economy = observation.economy;
  if (!ownPlayer || !frontiers) {
    return makeUnknownScore("Overextension risk needs own-player and frontier data.");
  }

  const borderRatio =
    frontiers.ownBorderTileCount !== null && ownPlayer.tilesOwned > 0
      ? frontiers.ownBorderTileCount / ownPlayer.tilesOwned
      : 0.2;
  const capPressure =
    economy?.maxTroops && economy.maxTroops > 0
      ? 1 - economy.troops / economy.maxTroops
      : 0.4;
  const hostilePressure = (strongestAdjacentHostile?.pressureScore ?? 20) / 100;
  const score = clamp(
    borderRatio * 180 + hostilePressure * 45 + (1 - capPressure) * 25,
    0,
    100,
  );
  return makeScore(
    score,
    `Border density, current troop fullness, and adjacent hostile strength all point to extension risk.`,
  );
}

function evaluateSafeAttackWindow(
  observation: Observation,
  strongestAdjacentHostile: StrategyPlayerPressure | null,
  overextensionRiskScore: number | null,
): { active: boolean; score: number | null; reason: string } {
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return {
      active: false,
      score: null,
      reason: "Own-player state is unavailable.",
    };
  }

  if (
    observation.game.session.spawnImmunityActive ||
    observation.game.session.nationSpawnImmunityActive
  ) {
    return {
      active: false,
      score: 0,
      reason: "Spawn immunity is still active, so aggressive timing is intentionally conservative.",
    };
  }

  if (!strongestAdjacentHostile) {
    return {
      active: false,
      score: 15,
      reason: "No adjacent hostile target is confirmed yet.",
    };
  }

  const troopRatio =
    strongestAdjacentHostile.troops > 0
      ? ownPlayer.troops / strongestAdjacentHostile.troops
      : 2;
  const score = clamp(
    troopRatio * 35 - (overextensionRiskScore ?? 40) * 0.4,
    0,
    100,
  );
  return {
    active: troopRatio >= 1.25 && (overextensionRiskScore ?? 100) <= 55,
    score,
    reason: `The current adjacent troop ratio is ${troopRatio.toFixed(2)} versus ${strongestAdjacentHostile.displayName}.`,
  };
}

function chooseRecommendedAttackPosture(
  observation: Observation,
  bestExpansionCandidate: StrategyExpansionTarget | null,
  localThreatScore: number | null,
  safeAttackWindow: boolean,
  overextensionRiskScore: number | null,
): RecommendedAttackPosture {
  if (safeAttackWindow) {
    return "expand";
  }

  if ((localThreatScore ?? 0) >= 75 || (overextensionRiskScore ?? 0) >= 75) {
    return "avoid";
  }

  if ((localThreatScore ?? 0) >= 45) {
    return "hold";
  }

  if (bestExpansionCandidate && bestExpansionCandidate.score >= 45) {
    return "poke";
  }

  return observation.frontiers?.adjacentHostilePlayers.length ? "hold" : "expand";
}

function scoreDefensePostOpportunity(
  observation: Observation,
  ownDefensePostCount: number,
  localThreatScore: number | null,
): StrategyScoreSignal {
  const frontiers = observation.frontiers;
  if (!frontiers) {
    return makeUnknownScore("Defense-post opportunity needs frontier data.");
  }

  const hostileCount = frontiers.adjacentHostilePlayers.length;
  const score = clamp(
    hostileCount * 20 + (localThreatScore ?? 20) * 0.4 - ownDefensePostCount * 18,
    0,
    100,
  );
  return makeScore(
    score,
    `${hostileCount} hostile frontiers versus ${ownDefensePostCount} owned defense posts determines current fortification opportunity.`,
  );
}

function scoreCitySafety(
  ownCities: ObservationVisibleEntity[],
  ownFactories: ObservationVisibleEntity[],
  ownPorts: ObservationVisibleEntity[],
  hostileStructures: ObservationVisibleEntity[],
  hostileUnits: ObservationVisibleEntity[],
  ownDefensePostCount: number,
): StrategyScoreSignal {
  const keyStructures = [...ownCities, ...ownFactories, ...ownPorts];
  if (keyStructures.length === 0) {
    return makeUnknownScore("No owned city, factory, or port is currently visible.");
  }

  let closestThreatDistance = Number.POSITIVE_INFINITY;
  for (const own of keyStructures) {
    for (const threat of [...hostileStructures, ...hostileUnits]) {
      closestThreatDistance = Math.min(
        closestThreatDistance,
        distanceBetweenTiles(own.position, threat.position),
      );
    }
  }

  const distanceScore =
    Number.isFinite(closestThreatDistance) && closestThreatDistance > 0
      ? clamp((closestThreatDistance / DEFENSE_POST_RANGE_TILES) * 40, 0, 70)
      : 20;
  const defenseScore = clamp(ownDefensePostCount * 10, 0, 30);
  return makeScore(
    distanceScore + defenseScore,
    Number.isFinite(closestThreatDistance)
      ? `Nearest visible hostile force is ${closestThreatDistance.toFixed(1)} tiles from a key structure.`
      : "No hostile force is currently visible near key structures.",
  );
}

function scoreBorderFortificationUrgency(
  observation: Observation,
  ownDefensePostCount: number,
  citySafetyScore: number | null,
  localThreatScore: number | null,
): StrategyUrgencySignal {
  const hostileCount = observation.frontiers?.adjacentHostilePlayers.length ?? 0;
  const score = clamp(
    hostileCount * 18 +
      (localThreatScore ?? 20) * 0.45 +
      Math.max(0, 40 - (citySafetyScore ?? 40)) -
      ownDefensePostCount * 12,
    0,
    100,
  );
  return makeUrgency(
    score,
    score >= 85
      ? "critical"
      : score >= 65
        ? "high"
        : score >= 40
          ? "medium"
          : "low",
    `${hostileCount} adjacent hostile borders and ${ownDefensePostCount} owned defense posts shape current fortification urgency.`,
  );
}

function scoreCoastalExposureRisk(
  ownPorts: ObservationVisibleEntity[],
  hostileWarships: ObservationVisibleEntity[],
  hostilePorts: ObservationVisibleEntity[],
): StrategyScoreSignal {
  if (ownPorts.length === 0) {
    return makeScore(5, "No owned port is currently visible, so coastal exposure is limited.");
  }

  let nearHostileNaval = 0;
  for (const ownPort of ownPorts) {
    for (const hostile of [...hostileWarships, ...hostilePorts]) {
      if (
        distanceBetweenTiles(ownPort.position, hostile.position) <= RADIUS_PORT_SPAWN_TILES * 2
      ) {
        nearHostileNaval++;
      }
    }
  }

  const score = clamp(ownPorts.length * 10 + nearHostileNaval * 22, 0, 100);
  return makeScore(
    score,
    `${ownPorts.length} owned ports and ${nearHostileNaval} nearby hostile naval points of contact define coastal exposure.`,
  );
}

function scoreTradeRouteValue(
  tradePotentialScore: number | null,
  ownPortCount: number,
  adjacentFriendlyCount: number,
): StrategyScoreSignal {
  const score = clamp(
    (tradePotentialScore ?? 0) * 0.7 + ownPortCount * 10 + adjacentFriendlyCount * 5,
    0,
    100,
  );
  return makeScore(
    score,
    `${ownPortCount} ports and ${adjacentFriendlyCount} adjacent friendlies shape current trade-route value.`,
  );
}

function scorePiracyRisk(
  ownPorts: ObservationVisibleEntity[],
  hostileWarships: ObservationVisibleEntity[],
): StrategyScoreSignal {
  if (ownPorts.length === 0) {
    return makeScore(0, "No owned port is currently visible.");
  }

  let nearThreats = 0;
  for (const port of ownPorts) {
    for (const warship of hostileWarships) {
      if (distanceBetweenTiles(port.position, warship.position) <= RADIUS_PORT_SPAWN_TILES * 2) {
        nearThreats++;
      }
    }
  }

  return makeScore(
    clamp(nearThreats * 25, 0, 100),
    `${nearThreats} hostile warship approaches are currently within practical pirate-harass distance of owned ports.`,
  );
}

function scoreEnemyPortHarassOpportunity(
  hostilePorts: ObservationVisibleEntity[],
  ownPorts: ObservationVisibleEntity[],
  hostileWarshipCount: number,
  safeAttackWindow: boolean,
): StrategyScoreSignal {
  if (hostilePorts.length === 0) {
    return makeScore(0, "No hostile port is currently visible.");
  }

  const score = clamp(
    hostilePorts.length * 16 + ownPorts.length * 10 + (safeAttackWindow ? 20 : 0) - hostileWarshipCount * 5,
    0,
    100,
  );
  return makeScore(
    score,
    `${hostilePorts.length} hostile ports are visible, with existing naval access and current combat tempo adjusting the harass value.`,
  );
}

function scoreHostileCluster(
  hostileStructures: ObservationVisibleEntity[],
  hostileUnits: ObservationVisibleEntity[],
): StrategyScoreSignal {
  if (hostileStructures.length === 0) {
    return makeScore(0, "No hostile structure cluster is currently visible.");
  }

  let bestScore = 0;
  for (const anchor of hostileStructures) {
    let structureCount = 0;
    let unitTroops = 0;
    for (const structure of hostileStructures) {
      if (
        distanceBetweenTiles(anchor.position, structure.position) <=
        HYDROGEN_OUTER_RADIUS_TILES
      ) {
        structureCount++;
      }
    }
    for (const unit of hostileUnits) {
      if (
        distanceBetweenTiles(anchor.position, unit.position) <=
        HYDROGEN_OUTER_RADIUS_TILES
      ) {
        unitTroops += Math.max(0, unit.troops);
      }
    }

    bestScore = Math.max(bestScore, structureCount * 12 + unitTroops / 40_000);
  }

  return makeScore(
    clamp(bestScore, 0, 100),
    "High-value hostile clustering is estimated from visible structures and troop concentrations within hydrogen-bomb-scale radius.",
  );
}

function scoreSamCoverageRisk(
  hostileStructures: ObservationVisibleEntity[],
  hostileSams: ObservationVisibleEntity[],
): StrategyScoreSignal {
  if (hostileStructures.length === 0) {
    return makeScore(0, "No hostile structure target is currently visible.");
  }
  if (hostileSams.length === 0) {
    return makeScore(0, "No hostile SAM launcher is currently visible.");
  }

  let coveredStructures = 0;
  for (const structure of hostileStructures) {
    const isCovered = hostileSams.some((sam) => {
      const level = Math.max(0, sam.level ?? 0);
      const range = MAX_SAM_RANGE_TILES - 480 / (level + 5);
      return distanceBetweenTiles(structure.position, sam.position) <= range;
    });
    if (isCovered) {
      coveredStructures++;
    }
  }

  const coverageRatio = coveredStructures / hostileStructures.length;
  return makeScore(
    clamp(coverageRatio * 100, 0, 100),
    `${coveredStructures} of ${hostileStructures.length} visible hostile structures sit inside observed SAM coverage.`,
  );
}

function scoreSiloOpportunity(
  economy: ObservationEconomyState | null,
  clusterScore: number | null,
  samCoverageRiskScore: number | null,
): StrategyScoreSignal {
  const gold = parseGold(economy?.gold ?? "0");
  const readySiloCount =
    economy?.ownedUnitCounts.find((entry) => entry.type === "Missile Silo")?.readyCount ?? 0;
  if (readySiloCount > 0) {
    return makeScore(20, "A ready missile silo already exists, so new silo urgency is limited.");
  }

  const affordability = gold !== null && gold >= SILO_COST_GOLD ? 35 : 10;
  const score = clamp(
    affordability + (clusterScore ?? 0) * 0.45 - (samCoverageRiskScore ?? 0) * 0.25,
    0,
    100,
  );
  return makeScore(
    score,
    gold === null
      ? "Gold could not be parsed, so silo opportunity is mostly strategic rather than budget-confirmed."
      : `Current gold is ${gold.toString()} against a known 1000000 silo build cost.`,
  );
}

function scoreOwnNukeVulnerability(
  ownCities: ObservationVisibleEntity[],
  ownFactories: ObservationVisibleEntity[],
  ownPorts: ObservationVisibleEntity[],
  ownSams: ObservationVisibleEntity[],
): StrategyScoreSignal {
  const keyStructures = [...ownCities, ...ownFactories, ...ownPorts];
  if (keyStructures.length <= 1) {
    return makeScore(10, "Owned key structures are sparse enough that visible clustering is low.");
  }

  let clusterHits = 0;
  for (const anchor of keyStructures) {
    let localHits = 0;
    for (const structure of keyStructures) {
      if (
        distanceBetweenTiles(anchor.position, structure.position) <=
        HYDROGEN_OUTER_RADIUS_TILES
      ) {
        localHits++;
      }
    }
    clusterHits = Math.max(clusterHits, localHits);
  }

  const samMitigation = clamp(ownSams.length * 12, 0, 40);
  const score = clamp(clusterHits * 18 - samMitigation, 0, 100);
  return makeScore(
    score,
    `${clusterHits} owned key structures fit inside a hydrogen-bomb-scale cluster, reduced by ${ownSams.length} visible SAM launchers.`,
  );
}

function scoreAdjacentFriendlyValue(
  adjacentFriendlies: ObservationDiplomacyPlayer[],
  diplomacy: Observation["diplomacy"],
): StrategyScoreSignal {
  if (adjacentFriendlies.length === 0) {
    return makeScore(5, "No adjacent friendly border is currently confirmed.");
  }

  const alliedAdjacents = adjacentFriendlies.filter((player) => player.isAlliedWithMe).length;
  const totalTroops = adjacentFriendlies.reduce((sum, player) => sum + player.troops, 0);
  const allyCount = diplomacy?.allyPlayerIds.length ?? 0;
  const score = clamp(
    adjacentFriendlies.length * 15 + alliedAdjacents * 12 + allyCount * 8 + totalTroops / 25_000,
    0,
    100,
  );
  return makeScore(
    score,
    `${adjacentFriendlies.length} adjacent friendlies, including ${alliedAdjacents} current allies, provide border value.`,
  );
}

function scoreAllianceBufferValue(
  adjacentFriendlyCount: number,
  adjacentHostileCount: number,
): StrategyScoreSignal {
  const score = clamp(adjacentFriendlyCount * 20 - adjacentHostileCount * 8 + 20, 0, 100);
  return makeScore(
    score,
    `${adjacentFriendlyCount} adjacent friendly borders offset ${adjacentHostileCount} hostile borders.`,
  );
}

function scoreAllianceTradeUpside(
  adjacentFriendlyCount: number,
  ownPortCount: number,
  tradePotentialScore: number | null,
): StrategyScoreSignal {
  const score = clamp(
    adjacentFriendlyCount * 18 + ownPortCount * 12 + (tradePotentialScore ?? 0) * 0.35,
    0,
    100,
  );
  return makeScore(
    score,
    `${adjacentFriendlyCount} adjacent friendlies and ${ownPortCount} owned ports define immediate alliance trade upside.`,
  );
}

function scoreBetrayalRisk(
  ownPlayer: Observation["ownPlayer"],
  adjacentFriendlies: ObservationDiplomacyPlayer[],
): StrategyScoreSignal {
  if (!ownPlayer || adjacentFriendlies.length === 0) {
    return makeScore(5, "No adjacent friendly border is currently confirmed.");
  }

  const riskyFriendlies = adjacentFriendlies.filter(
    (player) =>
      !player.isAlliedWithMe &&
      !player.isOnSameTeamAsMe &&
      player.troops >= ownPlayer.troops * 0.9,
  );
  const explicitHostility = adjacentFriendlies.filter(
    (player) => player.iTargetThem || player.theyTargetMe || player.theyEmbargoMe,
  ).length;
  const score = clamp(riskyFriendlies.length * 20 + explicitHostility * 25, 0, 100);
  return makeScore(
    score,
    `${riskyFriendlies.length} strong non-allied neighbors and ${explicitHostility} explicit hostile markers define betrayal risk.`,
  );
}

function scoreIsolationRisk(
  diplomacy: Observation["diplomacy"],
  adjacentFriendlyCount: number,
  adjacentHostileCount: number,
  ownPortCount: number,
): StrategyScoreSignal {
  const allyCount = diplomacy?.allyPlayerIds.length ?? 0;
  const score = clamp(
    45 -
      adjacentFriendlyCount * 12 -
      allyCount * 10 -
      ownPortCount * 6 +
      adjacentHostileCount * 14,
    0,
    100,
  );
  return makeScore(
    score,
    `${adjacentFriendlyCount} adjacent friendlies, ${allyCount} allies, and ${ownPortCount} ports offset ${adjacentHostileCount} hostile borders.`,
  );
}

function getAdjacentPlayers(
  observation: Observation,
  relation: "hostile" | "friendly",
): ObservationDiplomacyPlayer[] {
  const frontiers = observation.frontiers;
  const diplomacy = observation.diplomacy;
  if (!frontiers || !diplomacy) {
    return [];
  }

  const ids =
    relation === "hostile"
      ? frontiers.adjacentHostilePlayers.map((frontier) => frontier.playerId)
      : frontiers.adjacentFriendlyPlayers.map((frontier) => frontier.playerId);
  const uniqueIds = new Set(ids);
  return [...uniqueIds]
    .map((id) => diplomacy.players.find((player) => player.playerId === id) ?? null)
    .filter((player): player is ObservationDiplomacyPlayer => player !== null);
}

function getHostilePlayers(observation: Observation): ObservationDiplomacyPlayer[] {
  return (
    observation.diplomacy?.players.filter(
      (player) =>
        player.isAlive &&
        player.hasSpawned &&
        !player.isDisconnected &&
        !player.isFriendlyToMe &&
        !player.isAlliedWithMe &&
        !player.isOnSameTeamAsMe,
    ) ?? []
  );
}

function rankHostiles(
  ownPlayer: Observation["ownPlayer"],
  hostiles: ObservationDiplomacyPlayer[],
): StrategyPlayerPressure[] {
  return hostiles
    .map((player) => {
      const troopPressure =
        ownPlayer && ownPlayer.troops > 0
          ? clamp((player.troops / ownPlayer.troops) * 55, 0, 55)
          : 25;
      const tilePressure =
        ownPlayer && ownPlayer.tilesOwned > 0
          ? clamp((player.tilesOwned / ownPlayer.tilesOwned) * 35, 0, 35)
          : 15;
      const hostilityBonus =
        player.theyTargetMe || player.theyEmbargoMe || player.iTargetThem ? 10 : 0;
      return {
        playerId: player.playerId,
        displayName: player.displayName,
        tilesOwned: player.tilesOwned,
        troops: player.troops,
        pressureScore: clamp(troopPressure + tilePressure + hostilityBonus, 0, 100),
      };
    })
    .sort((left, right) => {
      if (right.pressureScore !== left.pressureScore) {
        return right.pressureScore - left.pressureScore;
      }
      return left.playerId.localeCompare(right.playerId);
    });
}

function normalizedEdgeBuffer(
  tile: ObservationTilePosition,
  width: number,
  height: number,
): number {
  const edgeDistance = Math.min(tile.x, tile.y, width - 1 - tile.x, height - 1 - tile.y);
  const maxEdgeDistance = Math.max(1, Math.min(width, height) / 2);
  return clamp(edgeDistance / maxEdgeDistance, 0, 1);
}

function distanceBetweenTiles(
  left: ObservationTilePosition,
  right: ObservationTilePosition,
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function parseGold(value: string | null | undefined): bigint | null {
  if (!value) {
    return 0n;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function makeScore(score: number, reason: string): StrategyScoreSignal {
  const rounded = roundScore(score);
  return {
    score: rounded,
    band: scoreToBand(rounded),
    reason,
  };
}

function makeUnknownScore(reason: string): StrategyScoreSignal {
  return {
    score: null,
    band: "unknown",
    reason,
  };
}

function makeUrgency(
  score: number | null,
  urgency: UrgencyLevel,
  reason: string,
): StrategyUrgencySignal {
  return {
    score: score === null ? null : roundScore(score),
    urgency,
    reason,
  };
}

function scoreToBand(score: number): StrategyBand {
  if (score >= 85) {
    return "very_high";
  }
  if (score >= 65) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  if (score >= 20) {
    return "low";
  }
  return "very_low";
}

function describeBand(band: StrategyBand): string {
  switch (band) {
    case "very_high":
      return "very high";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "very_low":
      return "very low";
    default:
      return "unknown";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}
