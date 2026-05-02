import type { Observation } from "../ObservationAdapter";
import {
  FORMULA_REGISTRY,
  getFormulaRegistryEntry,
  type FormulaRegistryEntry,
} from "../formulas/FormulaRegistry";
import type {
  GrowthTempoAssessment,
  GrowthTempoRecommendation,
  GrowthTempoUrgency,
} from "./AdvisorTypes";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";

const GROWTH_FORMULA_KEY = "growth.troops";
const LOW_GROWTH_EFFICIENCY_PERCENT = 65;
const HIGH_GROWTH_EFFICIENCY_PERCENT = 80;

export function evaluateGrowthTempo(
  observation: Observation,
  strategyState?: StrategyState | null,
  formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
): GrowthTempoAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ownPlayer = observation.ownPlayer;
  const economy = observation.economy;

  if (!ownPlayer || !economy) {
    return {
      currentTroops: ownPlayer?.troops ?? economy?.troops ?? null,
      maxTroops: economy?.maxTroops ?? null,
      troopCapRatio: null,
      growthEfficiencyPercent: null,
      currentTroopIncreasePerTick: economy?.troopIncreasePerTick ?? null,
      nearCapPressure: "unknown",
      recommendation: "unknown",
      urgency: "unknown",
      reasons: [
        !ownPlayer
          ? "Own-player state is unavailable."
          : "Economy state is unavailable.",
      ],
      warnings,
    };
  }

  const currentTroops = economy.troops;
  const maxTroops = economy.maxTroops;
  const currentTroopIncreasePerTick = economy.troopIncreasePerTick;

  if (maxTroops === null || maxTroops <= 0) {
    warnings.push("Observation does not expose a usable troop cap.");
    return {
      currentTroops,
      maxTroops,
      troopCapRatio: null,
      growthEfficiencyPercent: null,
      currentTroopIncreasePerTick,
      nearCapPressure: "unknown",
      recommendation: "unknown",
      urgency: "unknown",
      reasons: ["Troop tempo analysis needs a positive observed troop cap."],
      warnings,
    };
  }

  const troopCapRatio = clamp(currentTroops / maxTroops, 0, 1.25);
  const nearCapPressure = classifyNearCapPressure(troopCapRatio);
  const growthFormula = resolveGrowthFormulaEntry(formulas);
  const growthEfficiencyPercent = computeGrowthEfficiencyPercent(
    troopCapRatio,
    growthFormula,
    warnings,
  );
  const threatHigh = isThreatHigh(strategyState);
  const threatReason = strategyState?.frontierCombat.localThreatLevel.reason ?? null;
  const gold = parseObservedGold(economy.gold ?? ownPlayer.gold);

  reasons.push(
    `Current troops are ${formatNumber(currentTroops)} out of ${formatNumber(maxTroops)} cap (${(troopCapRatio * 100).toFixed(1)}%).`,
  );

  if (currentTroopIncreasePerTick !== null) {
    reasons.push(
      `Observed troop growth is ${formatDecimal(currentTroopIncreasePerTick)} troop(s) per tick.`,
    );
  } else {
    warnings.push("Observation does not expose current troop growth per tick.");
  }

  if (growthEfficiencyPercent !== null) {
    reasons.push(
      `Current troop level retains ${growthEfficiencyPercent.toFixed(1)}% of cap-scaled troop growth efficiency.`,
    );
  }

  if (threatReason) {
    reasons.push(threatReason);
  }

  const recommendation = chooseRecommendation(
    troopCapRatio,
    growthEfficiencyPercent,
    currentTroopIncreasePerTick,
    gold,
    threatHigh,
  );
  const urgency = chooseUrgency(
    nearCapPressure,
    recommendation,
    growthEfficiencyPercent,
    threatHigh,
  );

  if (threatHigh && recommendation === "raise_cap") {
    warnings.push(
      "Local threat is high, so the advisor avoids recommending attack-spend purely to bleed cap pressure.",
    );
  }

  if (growthEfficiencyPercent !== null && growthEfficiencyPercent <= 20) {
    warnings.push("Current troop level is wasting most troop growth because it is pressed against the observed cap.");
  }

  return {
    currentTroops,
    maxTroops,
    troopCapRatio,
    growthEfficiencyPercent,
    currentTroopIncreasePerTick,
    nearCapPressure,
    recommendation,
    urgency,
    reasons,
    warnings,
  };
}

function resolveGrowthFormulaEntry(
  formulas: readonly FormulaRegistryEntry[],
): FormulaRegistryEntry | null {
  return (
    formulas.find((entry) => entry.key === GROWTH_FORMULA_KEY) ??
    getFormulaRegistryEntry(GROWTH_FORMULA_KEY) ??
    null
  );
}

function computeGrowthEfficiencyPercent(
  troopCapRatio: number,
  growthFormula: FormulaRegistryEntry | null,
  warnings: string[],
): number | null {
  if (!growthFormula || growthFormula.status !== "verified") {
    warnings.push(
      "Verified growth formula metadata is unavailable, so growth efficiency stays unknown.",
    );
    return null;
  }

  const inferredEfficiency = clamp(1 - troopCapRatio, 0, 1) * 100;
  return Number(inferredEfficiency.toFixed(1));
}

function chooseRecommendation(
  troopCapRatio: number,
  growthEfficiencyPercent: number | null,
  currentTroopIncreasePerTick: number | null,
  gold: bigint | null,
  threatHigh: boolean,
): GrowthTempoRecommendation {
  if (troopCapRatio >= 0.9) {
    if (threatHigh) {
      return "raise_cap";
    }
    return gold !== null ? "raise_cap" : "attack_spend";
  }

  if (troopCapRatio >= 0.8) {
    if (threatHigh) {
      return "raise_cap";
    }
    if (currentTroopIncreasePerTick !== null && currentTroopIncreasePerTick <= 0) {
      return "raise_cap";
    }
    return gold !== null ? "raise_cap" : "attack_spend";
  }

  if (growthEfficiencyPercent !== null && growthEfficiencyPercent < LOW_GROWTH_EFFICIENCY_PERCENT) {
    return threatHigh ? "economy_shift" : "hold_grow";
  }

  if (growthEfficiencyPercent !== null && growthEfficiencyPercent >= HIGH_GROWTH_EFFICIENCY_PERCENT) {
    return "hold_grow";
  }

  if (currentTroopIncreasePerTick !== null && currentTroopIncreasePerTick <= 0) {
    return "raise_cap";
  }

  return "hold_grow";
}

function chooseUrgency(
  nearCapPressure: GrowthTempoUrgency,
  recommendation: GrowthTempoRecommendation,
  growthEfficiencyPercent: number | null,
  threatHigh: boolean,
): GrowthTempoUrgency {
  if (nearCapPressure === "critical") {
    return threatHigh && recommendation !== "attack_spend" ? "high" : "critical";
  }

  if (nearCapPressure === "high") {
    return recommendation === "attack_spend" || recommendation === "raise_cap"
      ? "high"
      : "medium";
  }

  if (growthEfficiencyPercent !== null && growthEfficiencyPercent < LOW_GROWTH_EFFICIENCY_PERCENT) {
    return threatHigh ? "high" : "medium";
  }

  if (nearCapPressure === "medium") {
    return "medium";
  }

  return nearCapPressure;
}

function classifyNearCapPressure(troopCapRatio: number): GrowthTempoUrgency {
  if (troopCapRatio >= 0.9) {
    return "critical";
  }
  if (troopCapRatio >= 0.8) {
    return "high";
  }
  if (troopCapRatio >= 0.65) {
    return "medium";
  }
  return "low";
}

function isThreatHigh(strategyState?: StrategyState | null): boolean {
  const localThreat = strategyState?.frontierCombat.localThreatLevel;
  if (!localThreat) {
    return false;
  }
  return (
    localThreat.band === "high" ||
    localThreat.band === "very_high" ||
    (localThreat.score ?? 0) >= 70
  );
}

function parseObservedGold(rawGold: string | null | undefined): bigint | null {
  if (typeof rawGold !== "string" || rawGold.length === 0) {
    return null;
  }
  try {
    return BigInt(rawGold);
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : String(value);
}

function formatDecimal(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : String(value);
}
