import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  Observation,
  ObservationDiplomacyPlayer,
  ObservationEconomyState,
  ObservationTilePosition,
  ObservationVisibleEntity,
} from "../../browser/page-adapter/ObservationAdapter";
import type { MechanicsGenerated } from "../../shared/mechanics/mechanics.types";

export type NukeScoringMode =
  | "population"
  | "economy"
  | "sams"
  | "destruction";

export type NukeSuggestionReasonCode =
  | "nukes_disabled"
  | "no_hostile_targets"
  | "no_launcher"
  | "no_budget"
  | "blocked_by_sam"
  | "low_score";

export type NukePayloadType = "Atom Bomb" | "Hydrogen Bomb" | "MIRV";

export interface NukeSuggestionOptions {
  minScore?: number;
  limit?: number;
}

export interface NukeSuggestionCoverage {
  hostileStructureCount: number;
  hostileCityCount: number;
  hostileFactoryCount: number;
  hostileSamCount: number;
  hostileMissileSiloCount: number;
  hostileTroops: number;
  hostileCityLevels: number;
  affectedPlayerIds: string[];
}

export interface NukeSuggestionScoreBreakdown {
  population: number;
  economy: number;
  sams: number;
  destruction: number;
}

export interface NukeSamThreat {
  launcherId: number;
  ownerPlayerId: string;
  ownerDisplayName: string;
  level: number;
  distanceToTarget: number;
  range: number;
}

export interface NukeSuggestionCandidate {
  accepted: boolean;
  mode: NukeScoringMode;
  payloadType: NukePayloadType;
  targetTile: ObservationTilePosition;
  targetPlayerId: string;
  targetPlayerDisplayName: string;
  score: number;
  reasons: NukeSuggestionReasonCode[];
  scoreBreakdown: NukeSuggestionScoreBreakdown;
  coverage: NukeSuggestionCoverage;
  blockedBySams: NukeSamThreat[];
}

export interface NukeSuggestionResult {
  mode: NukeScoringMode;
  minScore: number;
  globalReasons: NukeSuggestionReasonCode[];
  suggestions: NukeSuggestionCandidate[];
  rejected: NukeSuggestionCandidate[];
}

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SCORE = 10;
const MIN_SCORE_BY_MODE: Record<NukeScoringMode, number> = {
  population: 10,
  economy: 12,
  sams: 8,
  destruction: 14,
};
const SAM_LAUNCHER_TYPE = "SAM Launcher";
const MISSILE_SILO_TYPE = "Missile Silo";
const SUPPORTED_PAYLOADS: readonly NukePayloadType[] = [
  "Hydrogen Bomb",
  "Atom Bomb",
  "MIRV",
] as const;

interface ExtractedNukeMechanics {
  disabledUnits: readonly string[];
  magnitudes: Readonly<
    Record<string, { inner: number; outer: number }>
  >;
  maxSamRange: number;
  atomBombCost: number;
  hydrogenBombCost: number;
}

interface OwnedUnitAvailability {
  count: number;
  readyCount: number;
}

interface PayloadOption {
  payloadType: NukePayloadType;
  outerRadius: number;
  availableWithoutSpend: boolean;
  budgetRequired: number | null;
}

let cachedMechanics: ExtractedNukeMechanics | null = null;

export function suggestNukeTargets(
  observation: Observation,
  mode: NukeScoringMode,
  options: NukeSuggestionOptions = {},
): NukeSuggestionResult {
  const mechanics = getNukeMechanics();
  const minScore = options.minScore ?? MIN_SCORE_BY_MODE[mode] ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;

  if (isNukesDisabled(observation, mechanics.disabledUnits)) {
    return {
      mode,
      minScore,
      globalReasons: ["nukes_disabled"],
      suggestions: [],
      rejected: [],
    };
  }

  const economy = observation.economy;
  const readySiloCount = getOwnedUnitAvailability(
    economy,
    [MISSILE_SILO_TYPE, "MissileSilo"],
  ).readyCount;
  const affordablePayloads = getAffordablePayloads(economy, mechanics);

  const globalReasons: NukeSuggestionReasonCode[] = [];
  if (readySiloCount <= 0) {
    globalReasons.push("no_launcher");
  }
  if (affordablePayloads.length === 0) {
    globalReasons.push("no_budget");
  }
  if (globalReasons.length > 0) {
    return {
      mode,
      minScore,
      globalReasons,
      suggestions: [],
      rejected: [],
    };
  }

  const hostilePlayers = getHostilePlayers(observation);
  const hostilePlayerIds = new Set(hostilePlayers.map((player) => player.playerId));
  const hostileStructures = observation.visibleStructures.filter(
    (entity) =>
      hostilePlayerIds.has(entity.ownerPlayerId) &&
      !entity.isUnderConstruction,
  );

  if (hostileStructures.length === 0) {
    return {
      mode,
      minScore,
      globalReasons: ["no_hostile_targets"],
      suggestions: [],
      rejected: [],
    };
  }

  const hostileUnits = observation.visibleUnits.filter(
    (entity) =>
      hostilePlayerIds.has(entity.ownerPlayerId) && !entity.isUnderConstruction,
  );
  const samThreats = buildSamThreatIndex(hostileStructures, hostilePlayers, mechanics);

  const candidates = hostileStructures
    .map((target) =>
      buildBestCandidateForTarget(
        target,
        hostileStructures,
        hostileUnits,
        hostilePlayers,
        samThreats,
        affordablePayloads,
        mode,
        minScore,
      ),
    )
    .filter((candidate): candidate is NukeSuggestionCandidate => candidate !== null);

  const suggestions = candidates
    .filter((candidate) => candidate.accepted)
    .sort(compareCandidates)
    .slice(0, limit);
  const rejected = candidates
    .filter((candidate) => !candidate.accepted)
    .sort(compareCandidates);

  return {
    mode,
    minScore,
    globalReasons: [],
    suggestions,
    rejected,
  };
}

function buildBestCandidateForTarget(
  target: ObservationVisibleEntity,
  hostileStructures: readonly ObservationVisibleEntity[],
  hostileUnits: readonly ObservationVisibleEntity[],
  hostilePlayers: readonly ObservationDiplomacyPlayer[],
  samThreats: readonly NukeSamThreatIndexEntry[],
  payloads: readonly PayloadOption[],
  mode: NukeScoringMode,
  minScore: number,
): NukeSuggestionCandidate | null {
  const targetPlayer = hostilePlayers.find(
    (player) => player.playerId === target.ownerPlayerId,
  );
  if (!targetPlayer) {
    return null;
  }

  const rankedPayloads = payloads
    .map((payload) =>
      buildCandidate(
        payload,
        target,
        targetPlayer,
        hostileStructures,
        hostileUnits,
        samThreats,
        mode,
        minScore,
      ),
    )
    .sort(compareCandidates);

  return rankedPayloads[0] ?? null;
}

function buildCandidate(
  payload: PayloadOption,
  target: ObservationVisibleEntity,
  targetPlayer: ObservationDiplomacyPlayer,
  hostileStructures: readonly ObservationVisibleEntity[],
  hostileUnits: readonly ObservationVisibleEntity[],
  samThreats: readonly NukeSamThreatIndexEntry[],
  mode: NukeScoringMode,
  minScore: number,
): NukeSuggestionCandidate {
  const coverage = computeCoverage(
    target.position,
    payload.outerRadius,
    hostileStructures,
    hostileUnits,
  );
  const scoreBreakdown = computeScoreBreakdown(coverage);
  const score = roundScore(scoreBreakdown[mode]);
  const blockedBySams = findBlockingSamThreats(
    target.position,
    samThreats,
  );

  const reasons: NukeSuggestionReasonCode[] = [];
  if (blockedBySams.length > 0) {
    reasons.push("blocked_by_sam");
  }
  if (score < minScore) {
    reasons.push("low_score");
  }

  return {
    accepted: reasons.length === 0,
    mode,
    payloadType: payload.payloadType,
    targetTile: target.position,
    targetPlayerId: targetPlayer.playerId,
    targetPlayerDisplayName: targetPlayer.displayName,
    score,
    reasons,
    scoreBreakdown,
    coverage,
    blockedBySams: blockedBySams.map((threat) => ({
      launcherId: threat.launcherId,
      ownerPlayerId: threat.ownerPlayerId,
      ownerDisplayName: threat.ownerDisplayName,
      level: threat.level,
      distanceToTarget: roundScore(
        distanceBetweenTiles(threat.position, target.position),
      ),
      range: roundScore(threat.range),
    })),
  };
}

function computeCoverage(
  target: ObservationTilePosition,
  radius: number,
  hostileStructures: readonly ObservationVisibleEntity[],
  hostileUnits: readonly ObservationVisibleEntity[],
): NukeSuggestionCoverage {
  let hostileStructureCount = 0;
  let hostileCityCount = 0;
  let hostileFactoryCount = 0;
  let hostileSamCount = 0;
  let hostileMissileSiloCount = 0;
  let hostileTroops = 0;
  let hostileCityLevels = 0;
  const affectedPlayerIds = new Set<string>();

  for (const structure of hostileStructures) {
    if (distanceBetweenTiles(target, structure.position) > radius) {
      continue;
    }

    hostileStructureCount++;
    affectedPlayerIds.add(structure.ownerPlayerId);

    if (structure.type === "City") {
      hostileCityCount++;
      hostileCityLevels += structure.level ?? 0;
    }
    if (structure.type === "Factory") {
      hostileFactoryCount++;
    }
    if (structure.type === SAM_LAUNCHER_TYPE) {
      hostileSamCount++;
    }
    if (structure.type === MISSILE_SILO_TYPE) {
      hostileMissileSiloCount++;
    }
  }

  for (const unit of hostileUnits) {
    if (distanceBetweenTiles(target, unit.position) > radius) {
      continue;
    }
    hostileTroops += Math.max(0, unit.troops);
    affectedPlayerIds.add(unit.ownerPlayerId);
  }

  return {
    hostileStructureCount,
    hostileCityCount,
    hostileFactoryCount,
    hostileSamCount,
    hostileMissileSiloCount,
    hostileTroops,
    hostileCityLevels,
    affectedPlayerIds: [...affectedPlayerIds].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function computeScoreBreakdown(
  coverage: NukeSuggestionCoverage,
): NukeSuggestionScoreBreakdown {
  const troopScore = Math.min(40, coverage.hostileTroops / 25_000);
  const population =
    coverage.hostileCityCount * 6 +
    coverage.hostileCityLevels * 1.5 +
    troopScore * 0.5;
  const economy =
    coverage.hostileFactoryCount * 8 +
    coverage.hostileCityCount * 4 +
    (coverage.hostileStructureCount - coverage.hostileCityCount) * 1.5;
  const sams =
    coverage.hostileSamCount * 12 + coverage.hostileMissileSiloCount * 4;
  const destruction =
    coverage.hostileStructureCount * 4 +
    coverage.hostileCityLevels +
    troopScore +
    coverage.affectedPlayerIds.length * 2;

  return {
    population: roundScore(population),
    economy: roundScore(economy),
    sams: roundScore(sams),
    destruction: roundScore(destruction),
  };
}

function buildSamThreatIndex(
  hostileStructures: readonly ObservationVisibleEntity[],
  hostilePlayers: readonly ObservationDiplomacyPlayer[],
  mechanics: ExtractedNukeMechanics,
): NukeSamThreatIndexEntry[] {
  return hostileStructures
    .filter(
      (structure) =>
        structure.type === SAM_LAUNCHER_TYPE && !structure.isUnderConstruction,
    )
    .map((launcher) => {
      const owner = hostilePlayers.find(
        (player) => player.playerId === launcher.ownerPlayerId,
      );
      const level = Math.max(0, launcher.level ?? 0);

      return {
        launcherId: launcher.id,
        ownerPlayerId: launcher.ownerPlayerId,
        ownerDisplayName: owner?.displayName ?? launcher.ownerPlayerId,
        level,
        position: launcher.position,
        range: computeSamRange(level, mechanics.maxSamRange),
      };
    });
}

function findBlockingSamThreats(
  target: ObservationTilePosition,
  samThreats: readonly NukeSamThreatIndexEntry[],
): NukeSamThreatIndexEntry[] {
  return samThreats.filter(
    (threat) => distanceBetweenTiles(target, threat.position) <= threat.range,
  );
}

function getHostilePlayers(
  observation: Observation,
): ObservationDiplomacyPlayer[] {
  const diplomacy = observation.diplomacy;
  if (!diplomacy) {
    return [];
  }

  return diplomacy.players.filter(
    (player) =>
      player.isAlive &&
      player.hasSpawned &&
      !player.isDisconnected &&
      !player.isFriendlyToMe &&
      !player.isAlliedWithMe &&
      !player.isOnSameTeamAsMe &&
      !player.iEmbargoThem &&
      !player.theyEmbargoMe,
  );
}

function getAffordablePayloads(
  economy: ObservationEconomyState | null,
  mechanics: ExtractedNukeMechanics,
): PayloadOption[] {
  const gold = parseGold(economy?.gold ?? "0");
  const atomAvailability = getOwnedUnitAvailability(economy, [
    "Atom Bomb",
    "AtomBomb",
  ]);
  const hydrogenAvailability = getOwnedUnitAvailability(economy, [
    "Hydrogen Bomb",
    "HydrogenBomb",
  ]);
  const mirvAvailability = getOwnedUnitAvailability(economy, ["MIRV"]);

  return SUPPORTED_PAYLOADS.map((payloadType) => {
    const fromInventory =
      payloadType === "Atom Bomb"
        ? atomAvailability.readyCount > 0
        : payloadType === "Hydrogen Bomb"
          ? hydrogenAvailability.readyCount > 0
          : mirvAvailability.readyCount > 0;

    const budgetRequired =
      payloadType === "Atom Bomb"
        ? mechanics.atomBombCost
        : payloadType === "Hydrogen Bomb"
          ? mechanics.hydrogenBombCost
          : null;

    return {
      payloadType,
      outerRadius: getPayloadOuterRadius(payloadType, mechanics.magnitudes),
      availableWithoutSpend: fromInventory,
      budgetRequired,
    };
  }).filter(
    (payload) =>
      payload.availableWithoutSpend ||
      (payload.budgetRequired !== null && gold >= BigInt(payload.budgetRequired)),
  );
}

function getOwnedUnitAvailability(
  economy: ObservationEconomyState | null,
  unitTypes: readonly string[],
): OwnedUnitAvailability {
  const count =
    economy?.ownedUnitCounts.find((entry) => unitTypes.includes(entry.type)) ?? null;
  return {
    count: count?.count ?? 0,
    readyCount: count?.readyCount ?? 0,
  };
}

function getPayloadOuterRadius(
  payloadType: NukePayloadType,
  magnitudes: Readonly<Record<string, { inner: number; outer: number }>>,
): number {
  if (payloadType === "MIRV") {
    return magnitudes.MIRVWarhead.outer;
  }
  if (payloadType === "Atom Bomb") {
    return magnitudes.AtomBomb.outer;
  }
  return magnitudes.HydrogenBomb.outer;
}

function computeSamRange(level: number, maxSamRange: number): number {
  return maxSamRange - 480 / (level + 5);
}

function compareCandidates(
  left: NukeSuggestionCandidate,
  right: NukeSuggestionCandidate,
): number {
  if (left.accepted !== right.accepted) {
    return left.accepted ? -1 : 1;
  }
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  if (left.payloadType !== right.payloadType) {
    return payloadPriority(left.payloadType) - payloadPriority(right.payloadType);
  }
  if (left.targetPlayerDisplayName !== right.targetPlayerDisplayName) {
    return left.targetPlayerDisplayName.localeCompare(right.targetPlayerDisplayName);
  }
  if (left.targetTile.y !== right.targetTile.y) {
    return left.targetTile.y - right.targetTile.y;
  }
  return left.targetTile.x - right.targetTile.x;
}

function payloadPriority(payloadType: NukePayloadType): number {
  switch (payloadType) {
    case "Hydrogen Bomb":
      return 0;
    case "Atom Bomb":
      return 1;
    case "MIRV":
      return 2;
    default:
      return 3;
  }
}

function isNukesDisabled(
  observation: Observation,
  disabledUnits: readonly string[],
): boolean {
  const config = observation.configSnapshot;
  const disabledUnitSet = new Set([
    ...config.rawGameConfig.disabledUnits,
    ...disabledUnits,
  ]);
  return (
    disabledUnitSet.has(MISSILE_SILO_TYPE) ||
    disabledUnitSet.has("MissileSilo") ||
    disabledUnitSet.has("Atom Bomb") ||
    disabledUnitSet.has("AtomBomb") ||
    disabledUnitSet.has("Hydrogen Bomb") ||
    disabledUnitSet.has("HydrogenBomb") ||
    observation.configSnapshot.rawGameConfig.publicGameModifiers?.isNukesDisabled ===
      true
  );
}

function distanceBetweenTiles(
  left: ObservationTilePosition,
  right: ObservationTilePosition,
): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function parseGold(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function getNukeMechanics(): ExtractedNukeMechanics {
  if (cachedMechanics) {
    return cachedMechanics;
  }

  const filePath = join(__dirname, "..", "..", "generated", "mechanics.generated.json");
  const parsed = JSON.parse(
    readFileSync(filePath, "utf8"),
  ) as MechanicsGenerated;

  cachedMechanics = {
    disabledUnits:
      parsed.playlistDerived.disabledUnitsByModifier.isNukesDisabled ?? [],
    magnitudes: parsed.constants.nukes.magnitudes,
    maxSamRange: parsed.constants.ranges.maxSamRange,
    atomBombCost: extractFixedFormulaCost(parsed.units.AtomBomb.cost.sourceExpression),
    hydrogenBombCost: extractFixedFormulaCost(
      parsed.units.HydrogenBomb.cost.sourceExpression,
    ),
  };

  return cachedMechanics;
}

function extractFixedFormulaCost(sourceExpression: string): number {
  const match = sourceExpression.match(/(\d[\d_]*)/);
  if (!match) {
    throw new Error(`Unable to extract fixed cost from expression: ${sourceExpression}`);
  }
  return Number(match[1].replaceAll("_", ""));
}

interface NukeSamThreatIndexEntry {
  launcherId: number;
  ownerPlayerId: string;
  ownerDisplayName: string;
  level: number;
  position: ObservationTilePosition;
  range: number;
}
