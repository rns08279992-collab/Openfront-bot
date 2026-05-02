import type {
  Observation,
  ObservationDiplomacyPlayer,
  ObservationVisibleEntity,
} from "../ObservationAdapter";
import {
  FORMULA_REGISTRY,
  getFormulaRegistryEntry,
  type FormulaRegistryEntry,
} from "../formulas/FormulaRegistry";
import type {
  AdvisorConfidence,
  TerrainCostEstimate,
  TerrainCostMapResult,
} from "./AdvisorTypes";
import type { ProtocolId } from "../../../shared/protocol/intents";

const DEFENSE_DEBUFF_MIDPOINT = 150_000;
const DEFENSE_DEBUFF_DECAY_RATE = Math.LN2 / 50_000;
const LARGE_ATTACKER_TILE_THRESHOLD = 100_000;
const BOT_DEFENDER_ATTACK_MODIFIER = 0.8;

const REQUIRED_FORMULA_KEYS = [
  "combat.attackerLoss",
  "combat.attackSpeed",
  "combat.terrainAndDefensePost",
  "diplomacy.traitor",
] as const;

interface FormulaLookup {
  attackerLoss: FormulaRegistryEntry | undefined;
  attackSpeed: FormulaRegistryEntry | undefined;
  terrainAndDefensePost: FormulaRegistryEntry | undefined;
  traitor: FormulaRegistryEntry | undefined;
}

export function buildTerrainCostMap(
  observation: Observation,
  formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
): TerrainCostMapResult {
  const warnings: string[] = [];
  const formulaLookup = resolveFormulaLookup(formulas, warnings);
  const ownPlayer = observation.ownPlayer;
  const frontiers = observation.frontiers;
  if (!ownPlayer) {
    return {
      tiles: [],
      warnings: [...warnings, "Own-player state is unavailable."],
      formulas: consumedFormulaKeys(formulaLookup),
    };
  }

  if (!frontiers) {
    return {
      tiles: [],
      warnings: [...warnings, "Frontier data is unavailable."],
      formulas: consumedFormulaKeys(formulaLookup),
    };
  }

  const diplomacyById = new Map<ProtocolId, ObservationDiplomacyPlayer>(
    (observation.diplomacy?.players ?? []).map((player) => [player.playerId, player]),
  );
  const visibleTileRefs = new Set<number>(collectVisibleTileRefs(observation));
  const seenTileRefs = new Set<number>();
  const tiles: TerrainCostEstimate[] = [];

  for (const hostileFrontier of frontiers.adjacentHostilePlayers) {
    for (const tileRef of hostileFrontier.targetTileRefs) {
      if (seenTileRefs.has(tileRef)) {
        continue;
      }
      seenTileRefs.add(tileRef);
      tiles.push(
        estimateHostileTileCost(
          observation,
          diplomacyById.get(hostileFrontier.playerId) ?? null,
          hostileFrontier.playerId,
          tileRef,
          visibleTileRefs.has(tileRef),
        ),
      );
    }
  }

  for (const tileRef of frontiers.nearbyFrontierTileRefs) {
    if (seenTileRefs.has(tileRef)) {
      continue;
    }
    seenTileRefs.add(tileRef);
    tiles.push(estimateNeutralTileCost(tileRef, visibleTileRefs.has(tileRef)));
  }

  tiles.sort((left, right) => left.tileRef - right.tileRef);

  return {
    tiles,
    warnings,
    formulas: consumedFormulaKeys(formulaLookup),
  };
}

function estimateHostileTileCost(
  observation: Observation,
  defender: ObservationDiplomacyPlayer | null,
  ownerPlayerId: ProtocolId,
  tileRef: number,
  isVisibleTile: boolean,
): TerrainCostEstimate {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return {
      tileRef,
      ownerPlayerId,
      terrainMultiplier: null,
      defensePostCoverageMultiplier: null,
      botTraitorModifier: null,
      largeAttackerModifier: null,
      largeDefenderModifier: null,
      troopRatioFactor: null,
      estimatedAttackerLossPerTile: null,
      estimatedDefenderLossPerTile: null,
      confidence: "unknown",
      reasons: ["Own-player state is unavailable."],
      warnings,
    };
  }

  const attackTroops = attackAmount(ownPlayer.troops, ownPlayer.playerType);
  const largeAttackerModifier = calculateLargeAttackerModifier(ownPlayer.tilesOwned);
  reasons.push(
    `Attacker size modifier uses ${ownPlayer.tilesOwned} owned tiles from observation.`,
  );

  let largeDefenderModifier: number | null = null;
  let troopRatioFactor: number | null = null;
  let estimatedDefenderLossPerTile: number | null = null;
  let botTraitorModifier: number | null = null;

  if (!defender) {
    warnings.push(
      `Tile ${tileRef} is frontier-adjacent to ${ownerPlayerId}, but diplomacy details for that player are unavailable.`,
    );
  } else {
    largeDefenderModifier = calculateLargeDefenderModifier(defender.tilesOwned);
    reasons.push(
      `Defender size modifier uses ${defender.tilesOwned} owned tiles from diplomacy.`,
    );

    if (defender.tilesOwned > 0) {
      estimatedDefenderLossPerTile = defender.troops / defender.tilesOwned;
      reasons.push(
        `Defender bleed uses ${defender.troops} troops across ${defender.tilesOwned} owned tiles.`,
      );
    } else {
      warnings.push(
        `Defender tile count for ${defender.playerId} is zero, so defender bleed cannot be estimated.`,
      );
    }

    if (attackTroops > 0) {
      troopRatioFactor = clamp(defender.troops / attackTroops, 0.6, 2);
      reasons.push(
        `Troop-ratio factor uses estimated attack amount ${formatNumber(attackTroops)}.`,
      );
    } else {
      warnings.push("Estimated attack amount is zero, so troop ratio is unavailable.");
    }

    if (
      defender.playerType === "BOT" &&
      (ownPlayer.playerType === "HUMAN" || ownPlayer.playerType === "NATION")
    ) {
      botTraitorModifier = BOT_DEFENDER_ATTACK_MODIFIER;
      reasons.push(
        "Observed attacker-vs-bot pairing applies the verified 0.8 bot defender multiplier.",
      );
    } else {
      warnings.push(
        `Traitor state for ${defender.playerId} is not exposed by observation, so the bot/traitor modifier is not fully known.`,
      );
    }
  }

  warnings.push(
    `Observation does not expose terrain type for tile ${tileRef}, so terrain-dependent attacker loss stays unknown.`,
  );
  warnings.push(
    `Observation does not expose defense-post coverage for tile ${tileRef}, so coverage multiplier stays unknown.`,
  );
  if (!isVisibleTile) {
    warnings.push(
      `Tile ${tileRef} is known from frontier adjacency but has no direct visible entity on it in this snapshot.`,
    );
  }

  return {
    tileRef,
    ownerPlayerId,
    terrainMultiplier: null,
    defensePostCoverageMultiplier: null,
    botTraitorModifier,
    largeAttackerModifier,
    largeDefenderModifier,
    troopRatioFactor,
    estimatedAttackerLossPerTile: null,
    estimatedDefenderLossPerTile,
    confidence: deriveConfidence(
      troopRatioFactor,
      estimatedDefenderLossPerTile,
      largeAttackerModifier,
      largeDefenderModifier,
      warnings,
    ),
    reasons,
    warnings,
  };
}

function estimateNeutralTileCost(
  tileRef: number,
  isVisibleTile: boolean,
): TerrainCostEstimate {
  const warnings = [
    `Tile ${tileRef} is a neutral frontier tile, so no owning player is exposed.`,
    `Observation does not expose terrain type for tile ${tileRef}, so terrain-dependent attacker loss stays unknown.`,
    `Observation does not expose defense-post coverage for tile ${tileRef}, so coverage multiplier stays unknown.`,
    "Terra-nullius-specific attack math is not fully represented in the registry-backed advisor output.",
  ];
  if (!isVisibleTile) {
    warnings.push(
      `Tile ${tileRef} is known from frontier adjacency but has no direct visible entity on it in this snapshot.`,
    );
  }

  return {
    tileRef,
    ownerPlayerId: null,
    terrainMultiplier: null,
    defensePostCoverageMultiplier: null,
    botTraitorModifier: null,
    largeAttackerModifier: null,
    largeDefenderModifier: null,
    troopRatioFactor: null,
    estimatedAttackerLossPerTile: null,
    estimatedDefenderLossPerTile: 0,
    confidence: "unknown",
    reasons: ["Neutral frontier ownership is known only as unowned territory."],
    warnings,
  };
}

function resolveFormulaLookup(
  formulas: readonly FormulaRegistryEntry[],
  warnings: string[],
): FormulaLookup {
  const attackerLoss = getFormulaEntry(formulas, "combat.attackerLoss", warnings);
  const attackSpeed = getFormulaEntry(formulas, "combat.attackSpeed", warnings);
  const terrainAndDefensePost = getFormulaEntry(
    formulas,
    "combat.terrainAndDefensePost",
    warnings,
  );
  const traitor = getFormulaEntry(formulas, "diplomacy.traitor", warnings);

  return {
    attackerLoss,
    attackSpeed,
    terrainAndDefensePost,
    traitor,
  };
}

function getFormulaEntry(
  formulas: readonly FormulaRegistryEntry[],
  key: (typeof REQUIRED_FORMULA_KEYS)[number],
  warnings: string[],
): FormulaRegistryEntry | undefined {
  const entry =
    formulas.find((candidate) => candidate.key === key) ?? getFormulaRegistryEntry(key);
  if (!entry) {
    warnings.push(`Formula registry entry ${key} is unavailable.`);
  }
  return entry;
}

function consumedFormulaKeys(formulaLookup: FormulaLookup): string[] {
  return Object.values(formulaLookup)
    .filter((entry): entry is FormulaRegistryEntry => Boolean(entry))
    .map((entry) => entry.key);
}

function collectVisibleTileRefs(observation: Observation): number[] {
  const visibleEntities = [
    ...observation.visibleUnits,
    ...observation.visibleStructures,
  ] as ObservationVisibleEntity[];
  return visibleEntities.map((entity) => entity.position.tileRef);
}

function attackAmount(troops: number, playerType: string): number {
  return playerType === "BOT" ? troops / 20 : troops / 5;
}

function calculateLargeAttackerModifier(attackerTilesOwned: number): number {
  if (attackerTilesOwned <= LARGE_ATTACKER_TILE_THRESHOLD) {
    return 1;
  }
  return Math.sqrt(LARGE_ATTACKER_TILE_THRESHOLD / attackerTilesOwned) ** 0.7;
}

function calculateLargeDefenderModifier(defenderTilesOwned: number): number {
  const defenseSig =
    1 -
    sigmoid(
      defenderTilesOwned,
      DEFENSE_DEBUFF_DECAY_RATE,
      DEFENSE_DEBUFF_MIDPOINT,
    );
  return 0.7 + 0.3 * defenseSig;
}

function sigmoid(value: number, decayRate: number, midpoint: number): number {
  return 1 / (1 + Math.exp(-decayRate * (value - midpoint)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function deriveConfidence(
  troopRatioFactor: number | null,
  defenderLossPerTile: number | null,
  largeAttackerModifier: number | null,
  largeDefenderModifier: number | null,
  warnings: string[],
): AdvisorConfidence {
  const knownFieldCount = [
    troopRatioFactor,
    defenderLossPerTile,
    largeAttackerModifier,
    largeDefenderModifier,
  ].filter((value) => value !== null).length;
  if (knownFieldCount === 0) {
    return "unknown";
  }
  if (warnings.length === 0) {
    return "verified";
  }
  return "partial";
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : String(value);
}
