import type { Observation, ObservationDiplomacyPlayer } from "../ObservationAdapter";
import { FORMULA_REGISTRY, type FormulaRegistryEntry } from "../formulas/FormulaRegistry";
import type {
  AttackMathAssessment,
  AttackRiskBand,
  AttackAdviceMode,
} from "./AdvisorTypes";
import { buildTerrainCostMap } from "./TerrainCostMap";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type { ProtocolId } from "../../../shared/protocol/intents";

export function evaluateAttackMath(
  observation: Observation,
  targetPlayerId: ProtocolId,
  strategyState?: StrategyState | null,
  formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
): AttackMathAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ownPlayer = observation.ownPlayer;
  if (!ownPlayer) {
    return {
      targetPlayerId,
      mode: "no_attack",
      recommendedTroops: null,
      minimumReserve: null,
      troopRatioFactor: null,
      effectiveAttackCost: null,
      defenderBleedRate: null,
      expectedRiskBand: "unknown",
      reasons: ["Own-player state is unavailable."],
      warnings,
    };
  }

  if (
    observation.game.session.spawnImmunityActive ||
    observation.game.session.nationSpawnImmunityActive
  ) {
    return {
      targetPlayerId,
      mode: "no_attack",
      recommendedTroops: null,
      minimumReserve: Math.ceil(ownPlayer.troops * 0.25),
      troopRatioFactor: null,
      effectiveAttackCost: null,
      defenderBleedRate: null,
      expectedRiskBand: "high",
      reasons: ["Spawn immunity is active, so aggressive attack advice is disabled."],
      warnings,
    };
  }

  const terrainMap = buildTerrainCostMap(observation, formulas);
  warnings.push(...terrainMap.warnings);

  const targetTiles = terrainMap.tiles.filter(
    (tile) => tile.ownerPlayerId === targetPlayerId,
  );
  const targetPlayer = findTargetPlayer(observation, targetPlayerId);

  if (!targetPlayer) {
    return {
      targetPlayerId,
      mode: "no_attack",
      recommendedTroops: null,
      minimumReserve: Math.ceil(ownPlayer.troops * 0.25),
      troopRatioFactor: null,
      effectiveAttackCost: null,
      defenderBleedRate: null,
      expectedRiskBand: "unknown",
      reasons: ["Target player is not exposed in diplomacy state."],
      warnings,
    };
  }

  if (targetTiles.length === 0) {
    return {
      targetPlayerId,
      mode: "no_attack",
      recommendedTroops: null,
      minimumReserve: Math.ceil(ownPlayer.troops * 0.25),
      troopRatioFactor: null,
      effectiveAttackCost: null,
      defenderBleedRate: null,
      expectedRiskBand: "unknown",
      reasons: ["No known hostile frontier tiles are exposed for the target player."],
      warnings,
    };
  }

  const baseAttackAmount = attackAmount(ownPlayer.troops, ownPlayer.playerType);
  const minimumReserve = calculateMinimumReserve(ownPlayer.troops, strategyState);
  const availableCommitment = Math.max(0, Math.floor(ownPlayer.troops - minimumReserve));
  const troopRatioFactor = averageOrNull(
    targetTiles.map((tile) => tile.troopRatioFactor),
  );
  const effectiveAttackCost = averageOrNull(
    targetTiles.map((tile) => tile.estimatedAttackerLossPerTile),
  );
  const defenderBleedRate = averageOrNull(
    targetTiles.map((tile) => tile.estimatedDefenderLossPerTile),
  );

  const troopStrengthRatio =
    targetPlayer.troops > 0 ? ownPlayer.troops / targetPlayer.troops : Infinity;
  reasons.push(
    `Observed troop ratio versus ${targetPlayer.displayName} is ${formatNumber(troopStrengthRatio)}.`,
  );
  reasons.push(
    `${targetTiles.length} target frontier tiles are currently known for ${targetPlayer.displayName}.`,
  );

  if (effectiveAttackCost === null) {
    warnings.push(
      "Terrain-dependent attacker loss is unavailable because observation does not expose terrain or defense-post coverage.",
    );
  }
  if (targetTiles.some((tile) => tile.confidence !== "verified")) {
    warnings.push(
      "At least one target tile estimate is partial or unknown, so attack advice is conservative.",
    );
  }

  const riskBand = classifyRiskBand(
    troopStrengthRatio,
    effectiveAttackCost,
    troopRatioFactor,
    strategyState,
  );
  const mode = chooseMode(
    troopStrengthRatio,
    effectiveAttackCost,
    riskBand,
    strategyState,
  );
  const recommendedTroops = recommendTroops(
    mode,
    baseAttackAmount,
    availableCommitment,
    targetPlayer.troops,
  );

  if (mode === "full_send_candidate") {
    warnings.push(
      "Full-send is surfaced only as a candidate signal; this advisor does not authorize or execute it.",
    );
  }

  if (effectiveAttackCost === null && mode !== "no_attack" && mode !== "limited") {
    warnings.push(
      "Missing attack-cost visibility would normally block stronger guidance, so the mode should be treated as tentative.",
    );
  }

  if (strategyState?.frontierCombat.safeAttackWindow.reason) {
    reasons.push(strategyState.frontierCombat.safeAttackWindow.reason);
  }

  return {
    targetPlayerId,
    mode,
    recommendedTroops,
    minimumReserve,
    troopRatioFactor,
    effectiveAttackCost,
    defenderBleedRate,
    expectedRiskBand: riskBand,
    reasons,
    warnings,
  };
}

function findTargetPlayer(
  observation: Observation,
  targetPlayerId: ProtocolId,
): ObservationDiplomacyPlayer | null {
  return (
    observation.diplomacy?.players.find(
      (player) => player.playerId === targetPlayerId,
    ) ?? null
  );
}

function attackAmount(troops: number, playerType: string): number {
  return playerType === "BOT" ? troops / 20 : troops / 5;
}

function calculateMinimumReserve(
  ownTroops: number,
  strategyState?: StrategyState | null,
): number {
  const overextensionScore =
    strategyState?.frontierCombat.overextensionRisk.score ?? 40;
  const reserveRatio = Math.min(Math.max(0.2 + overextensionScore / 250, 0.2), 0.6);
  return Math.max(1, Math.ceil(ownTroops * reserveRatio));
}

function chooseMode(
  troopStrengthRatio: number,
  effectiveAttackCost: number | null,
  riskBand: AttackRiskBand,
  strategyState?: StrategyState | null,
): AttackAdviceMode {
  if (strategyState?.frontierCombat.recommendedAttackPosture === "avoid") {
    return "no_attack";
  }
  if (riskBand === "extreme") {
    return "no_attack";
  }
  if (effectiveAttackCost === null) {
    if (troopStrengthRatio >= 1.5 && riskBand !== "high") {
      return "limited";
    }
    return "no_attack";
  }
  if (troopStrengthRatio < 0.95) {
    return "no_attack";
  }
  if (troopStrengthRatio < 1.15 || riskBand === "high") {
    return "poke";
  }
  if (troopStrengthRatio < 1.45 || riskBand === "medium") {
    return "limited";
  }
  if (troopStrengthRatio < 2 || strategyState?.frontierCombat.safeAttackWindow.active === false) {
    return "breakthrough";
  }
  return "full_send_candidate";
}

function recommendTroops(
  mode: AttackAdviceMode,
  baseAttackAmount: number,
  availableCommitment: number,
  defenderTroops: number,
): number | null {
  if (availableCommitment <= 0) {
    return 0;
  }
  switch (mode) {
    case "no_attack":
      return 0;
    case "poke":
      return Math.max(1, Math.min(availableCommitment, Math.ceil(baseAttackAmount * 0.5)));
    case "limited":
      return Math.max(
        1,
        Math.min(availableCommitment, Math.ceil(Math.max(baseAttackAmount, defenderTroops * 0.15))),
      );
    case "breakthrough":
      return Math.max(
        1,
        Math.min(availableCommitment, Math.ceil(Math.max(baseAttackAmount * 1.25, defenderTroops * 0.3))),
      );
    case "full_send_candidate":
      return availableCommitment;
  }
}

function classifyRiskBand(
  troopStrengthRatio: number,
  effectiveAttackCost: number | null,
  troopRatioFactor: number | null,
  strategyState?: StrategyState | null,
): AttackRiskBand {
  const overextensionScore =
    strategyState?.frontierCombat.overextensionRisk.score ?? 50;
  const safeWindowActive = strategyState?.frontierCombat.safeAttackWindow.active;
  let riskScore = 0;

  if (troopStrengthRatio < 0.9) {
    riskScore += 4;
  } else if (troopStrengthRatio < 1.1) {
    riskScore += 3;
  } else if (troopStrengthRatio < 1.35) {
    riskScore += 2;
  } else {
    riskScore += 1;
  }

  if (effectiveAttackCost === null) {
    riskScore += 2;
  } else if (effectiveAttackCost > 200) {
    riskScore += 2;
  }

  if (troopRatioFactor !== null && troopRatioFactor >= 1.5) {
    riskScore += 1;
  }
  if (overextensionScore >= 70) {
    riskScore += 2;
  } else if (overextensionScore >= 50) {
    riskScore += 1;
  }
  if (safeWindowActive === false) {
    riskScore += 1;
  }

  if (riskScore >= 7) {
    return "extreme";
  }
  if (riskScore >= 5) {
    return "high";
  }
  if (riskScore >= 3) {
    return "medium";
  }
  return "low";
}

function averageOrNull(values: Array<number | null>): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) {
    return null;
  }
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : String(value);
}
