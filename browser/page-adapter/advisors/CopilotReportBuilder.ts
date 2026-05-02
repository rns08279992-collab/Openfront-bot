import type { Observation } from "../ObservationAdapter";
import { FORMULA_REGISTRY, type FormulaRegistryEntry } from "../formulas/FormulaRegistry";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type {
  AttackMathAssessment,
  CopilotReadOnlyRecommendation,
  CopilotReport,
  CopilotReportRecommendationPriority,
  EnclosureOpportunityAssessment,
  GrowthTempoAssessment,
  TradeAllianceROIAdvisorResult,
} from "./AdvisorTypes";
import { evaluateAttackMath } from "./AttackMathEngine";
import { evaluateEnclosureOpportunities } from "./EnclosureAdvisor";
import { evaluateGrowthTempo } from "./GrowthTempoAdvisor";
import { buildTerrainCostMap } from "./TerrainCostMap";
import { evaluateTradeAllianceROI } from "./TradeAllianceROIAdvisor";

const MAX_TOP_WARNINGS = 8;

export function buildCopilotReport(
  observation: Observation,
  strategyState?: StrategyState | null,
  formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
): CopilotReport {
  const terrainCostMap = buildTerrainCostMap(observation, formulas);
  const attackAssessments = collectAdjacentHostileAttackAssessments(
    observation,
    strategyState,
    formulas,
  );
  const enclosureOpportunities = evaluateEnclosureOpportunities(observation);
  const growthTempo = evaluateGrowthTempo(observation, strategyState, formulas);
  const tradeAllianceROI = evaluateTradeAllianceROI(observation, strategyState, formulas);
  const nextBestReadOnlyRecommendation = chooseNextRecommendation(
    strategyState,
    growthTempo,
    attackAssessments,
    enclosureOpportunities,
    tradeAllianceROI,
  );
  const topWarnings = collectTopWarnings(
    nextBestReadOnlyRecommendation,
    terrainCostMap.warnings,
    growthTempo.warnings,
    tradeAllianceROI.warnings,
    attackAssessments.flatMap((assessment) => assessment.warnings),
    enclosureOpportunities.flatMap((opportunity) => opportunity.warnings),
  );

  return {
    terrainCostMap,
    attackAssessments,
    enclosureOpportunities,
    growthTempo,
    tradeAllianceROI,
    topWarnings,
    nextBestReadOnlyRecommendation,
  };
}

function collectAdjacentHostileAttackAssessments(
  observation: Observation,
  strategyState: StrategyState | null | undefined,
  formulas: readonly FormulaRegistryEntry[],
): AttackMathAssessment[] {
  const frontiers = observation.frontiers;
  if (!frontiers) {
    return [];
  }

  const hostilePlayerIds = new Set<string>([
    ...frontiers.adjacentHostilePlayerIds,
    ...frontiers.adjacentHostilePlayers.map((player) => player.playerId),
  ]);

  return [...hostilePlayerIds]
    .sort((left, right) => left.localeCompare(right))
    .map((targetPlayerId) =>
      evaluateAttackMath(observation, targetPlayerId, strategyState, formulas),
    );
}

function chooseNextRecommendation(
  strategyState: StrategyState | null | undefined,
  growthTempo: GrowthTempoAssessment,
  attackAssessments: AttackMathAssessment[],
  enclosureOpportunities: EnclosureOpportunityAssessment[],
  tradeAllianceROI: TradeAllianceROIAdvisorResult,
): CopilotReadOnlyRecommendation {
  const defenseRecommendation = buildDefenseRecommendation(strategyState, growthTempo);
  if (defenseRecommendation) {
    return defenseRecommendation;
  }

  const growthRecommendation = buildGrowthRecommendation(growthTempo);
  if (growthRecommendation) {
    return growthRecommendation;
  }

  const enclosureRecommendation = buildEnclosureRecommendation(enclosureOpportunities);
  if (enclosureRecommendation) {
    return enclosureRecommendation;
  }

  const attackRecommendation = buildAttackRecommendation(attackAssessments);
  if (attackRecommendation) {
    return attackRecommendation;
  }

  const tradeRecommendation = buildTradeRecommendation(tradeAllianceROI);
  if (tradeRecommendation) {
    return tradeRecommendation;
  }

  return buildUnknownRecommendation(
    growthTempo,
    attackAssessments,
    enclosureOpportunities,
    tradeAllianceROI,
  );
}

function buildDefenseRecommendation(
  strategyState: StrategyState | null | undefined,
  growthTempo: GrowthTempoAssessment,
): CopilotReadOnlyRecommendation | null {
  const localThreat = strategyState?.frontierCombat.localThreatLevel;
  if (!localThreat) {
    return null;
  }

  const threatPriority = mapThreatToPriority(localThreat.band, localThreat.score ?? null);
  if (threatPriority !== "critical" && threatPriority !== "high") {
    return null;
  }

  const reasons = [
    localThreat.reason || "Local threat is elevated.",
  ];
  if (
    growthTempo.nearCapPressure === "critical" ||
    growthTempo.nearCapPressure === "high"
  ) {
    reasons.push(
      "Growth cap pressure exists, but it should not outrank an already high local threat.",
    );
  }

  return {
    category: "defense",
    priority: threatPriority,
    summary: "Local threat is high enough that border stabilization should outrank growth or attack follow-through.",
    reasons,
    warnings: [],
  };
}

function buildGrowthRecommendation(
  growthTempo: GrowthTempoAssessment,
): CopilotReadOnlyRecommendation | null {
  if (
    growthTempo.urgency !== "critical" &&
    growthTempo.urgency !== "high"
  ) {
    return null;
  }

  if (
    growthTempo.recommendation !== "raise_cap" &&
    growthTempo.recommendation !== "attack_spend" &&
    growthTempo.recommendation !== "economy_shift"
  ) {
    return null;
  }

  return {
    category: "growth",
    priority: growthTempo.urgency,
    summary: summarizeGrowthRecommendation(growthTempo),
    reasons: [...growthTempo.reasons],
    warnings: [...growthTempo.warnings],
  };
}

function buildEnclosureRecommendation(
  enclosureOpportunities: EnclosureOpportunityAssessment[],
): CopilotReadOnlyRecommendation | null {
  const bestOpportunity =
    [...enclosureOpportunities]
      .filter((opportunity) => opportunity.status !== "none" && opportunity.status !== "unknown")
      .sort(compareEnclosureOpportunities)[0] ?? null;
  if (!bestOpportunity) {
    return null;
  }

  return {
    category: "enclosure",
    priority:
      bestOpportunity.status === "verifiedOpportunity" ? "critical" : "high",
    summary:
      bestOpportunity.status === "verifiedOpportunity"
        ? `A closure path on ${bestOpportunity.targetPlayerId} appears verified from current frontier data.`
        : `An inferred enclosure path on ${bestOpportunity.targetPlayerId} should outrank normal attack pressure.`,
    reasons: [...bestOpportunity.reasons],
    warnings: [...bestOpportunity.warnings],
  };
}

function buildAttackRecommendation(
  attackAssessments: AttackMathAssessment[],
): CopilotReadOnlyRecommendation | null {
  const bestAssessment =
    [...attackAssessments]
      .filter((assessment) => assessment.mode !== "no_attack")
      .filter((assessment) => assessment.expectedRiskBand !== "high")
      .filter((assessment) => assessment.expectedRiskBand !== "extreme")
      .sort(compareAttackAssessments)[0] ?? null;
  if (!bestAssessment) {
    return null;
  }

  return {
    category: "attack",
    priority: mapAttackToPriority(bestAssessment),
    summary: `Attack pressure on ${bestAssessment.targetPlayerId} looks actionable without surfacing a high-risk push.`,
    reasons: [...bestAssessment.reasons],
    warnings: [...bestAssessment.warnings],
  };
}

function buildTradeRecommendation(
  tradeAllianceROI: TradeAllianceROIAdvisorResult,
): CopilotReadOnlyRecommendation | null {
  if (
    tradeAllianceROI.recommendation === "unknown" ||
    tradeAllianceROI.recommendation === "deprioritize_trade"
  ) {
    return null;
  }

  return {
    category: "trade",
    priority: mapTradeToPriority(tradeAllianceROI),
    summary: summarizeTradeRecommendation(tradeAllianceROI),
    reasons: [...tradeAllianceROI.reasons],
    warnings: [...tradeAllianceROI.warnings],
  };
}

function buildUnknownRecommendation(
  growthTempo: GrowthTempoAssessment,
  attackAssessments: AttackMathAssessment[],
  enclosureOpportunities: EnclosureOpportunityAssessment[],
  tradeAllianceROI: TradeAllianceROIAdvisorResult,
): CopilotReadOnlyRecommendation {
  const reasons = collectUniqueStrings(
    growthTempo.reasons,
    attackAssessments.flatMap((assessment) => assessment.reasons),
    enclosureOpportunities.flatMap((opportunity) => opportunity.reasons),
    tradeAllianceROI.reasons,
  ).slice(0, 6);
  const warnings = collectUniqueStrings(
    growthTempo.warnings,
    attackAssessments.flatMap((assessment) => assessment.warnings),
    enclosureOpportunities.flatMap((opportunity) => opportunity.warnings),
    tradeAllianceROI.warnings,
  ).slice(0, 6);

  return {
    category: "unknown",
    priority: "unknown",
    summary: "Current observation does not support a stronger read-only recommendation without hiding uncertainty.",
    reasons,
    warnings,
  };
}

function summarizeGrowthRecommendation(growthTempo: GrowthTempoAssessment): string {
  switch (growthTempo.recommendation) {
    case "raise_cap":
      return "Growth is pressing the observed troop cap, so expanding cap should take priority.";
    case "attack_spend":
      return "Growth is nearing cap and available headroom is thin, so spending tempo is the least-bad pressure release.";
    case "economy_shift":
      return "Growth headroom is tightening enough to justify an economy-focused shift.";
    default:
      return "Growth pressure is elevated.";
  }
}

function summarizeTradeRecommendation(
  tradeAllianceROI: TradeAllianceROIAdvisorResult,
): string {
  switch (tradeAllianceROI.recommendation) {
    case "build_port":
      return "Trade looks like the clearest low-urgency upgrade, starting with port access.";
    case "upgrade_port":
      return "Existing trade access is usable enough that a port upgrade can surface next.";
    case "build_factory":
      return "Visible trade upside exists, but factory capacity is the missing internal enabler.";
    case "ally_for_trade":
      return "Alliance alignment can improve visible trade ROI more than a combat-first posture right now.";
    case "maintain_trade":
      return "Trade conditions are healthy enough to maintain rather than force a combat pivot.";
    default:
      return "Trade upside is present.";
  }
}

function compareEnclosureOpportunities(
  left: EnclosureOpportunityAssessment,
  right: EnclosureOpportunityAssessment,
): number {
  const statusDelta = enclosureRank(right.status) - enclosureRank(left.status);
  if (statusDelta !== 0) {
    return statusDelta;
  }
  const tilesDelta = (left.tilesToCloseEstimate ?? Number.MAX_SAFE_INTEGER) -
    (right.tilesToCloseEstimate ?? Number.MAX_SAFE_INTEGER);
  if (tilesDelta !== 0) {
    return tilesDelta;
  }
  return left.targetPlayerId.localeCompare(right.targetPlayerId);
}

function compareAttackAssessments(
  left: AttackMathAssessment,
  right: AttackMathAssessment,
): number {
  const modeDelta = attackModeRank(right.mode) - attackModeRank(left.mode);
  if (modeDelta !== 0) {
    return modeDelta;
  }
  const riskDelta = attackRiskRank(left.expectedRiskBand) - attackRiskRank(right.expectedRiskBand);
  if (riskDelta !== 0) {
    return riskDelta;
  }
  return (right.recommendedTroops ?? -1) - (left.recommendedTroops ?? -1);
}

function enclosureRank(status: EnclosureOpportunityAssessment["status"]): number {
  switch (status) {
    case "verifiedOpportunity":
      return 3;
    case "inferredOpportunity":
      return 2;
    case "unknown":
      return 1;
    case "none":
    default:
      return 0;
  }
}

function attackModeRank(mode: AttackMathAssessment["mode"]): number {
  switch (mode) {
    case "full_send_candidate":
      return 4;
    case "breakthrough":
      return 3;
    case "limited":
      return 2;
    case "poke":
      return 1;
    case "no_attack":
    default:
      return 0;
  }
}

function attackRiskRank(riskBand: AttackMathAssessment["expectedRiskBand"]): number {
  switch (riskBand) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "extreme":
      return 3;
    case "unknown":
    default:
      return 4;
  }
}

function mapThreatToPriority(
  band: StrategyState["frontierCombat"]["localThreatLevel"]["band"],
  score: number | null,
): CopilotReportRecommendationPriority {
  if (band === "very_high" || (score ?? 0) >= 90) {
    return "critical";
  }
  if (band === "high" || (score ?? 0) >= 70) {
    return "high";
  }
  return "medium";
}

function mapAttackToPriority(
  assessment: AttackMathAssessment,
): CopilotReportRecommendationPriority {
  if (assessment.mode === "full_send_candidate" || assessment.mode === "breakthrough") {
    return assessment.expectedRiskBand === "low" ? "high" : "medium";
  }
  if (assessment.mode === "limited") {
    return "medium";
  }
  if (assessment.mode === "poke") {
    return "low";
  }
  return "unknown";
}

function mapTradeToPriority(
  tradeAllianceROI: TradeAllianceROIAdvisorResult,
): CopilotReportRecommendationPriority {
  if (
    tradeAllianceROI.confidence === "unknown" ||
    tradeAllianceROI.recommendation === "ally_for_trade"
  ) {
    return "unknown";
  }
  if (
    tradeAllianceROI.recommendation === "build_port" ||
    tradeAllianceROI.recommendation === "build_factory"
  ) {
    return "medium";
  }
  return "low";
}

function collectTopWarnings(
  selectedRecommendation: CopilotReadOnlyRecommendation,
  ...warningGroups: string[][]
): string[] {
  return collectUniqueStrings(selectedRecommendation.warnings, ...warningGroups).slice(
    0,
    MAX_TOP_WARNINGS,
  );
}

function collectUniqueStrings(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const collected: string[] = [];

  for (const group of groups) {
    for (const value of group) {
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      collected.push(value);
    }
  }

  return collected;
}
