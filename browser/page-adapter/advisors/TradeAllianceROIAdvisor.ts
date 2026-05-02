import type { Observation, ObservationDiplomacyPlayer } from "../ObservationAdapter";
import {
  FORMULA_REGISTRY,
  getFormulaRegistryEntry,
  type FormulaRegistryEntry,
} from "../formulas/FormulaRegistry";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type {
  TradeAlliancePartnerAssessment,
  TradeAllianceROIAdvisorResult,
  TradeAllianceRecommendation,
  TradeAllianceRelation,
} from "./AdvisorTypes";

const PORT_AND_TRADE_SHIPS_FORMULA_KEY = "economy.portAndTradeShips";
const TRAIN_PAYOUT_FORMULA_KEY = "economy.trainPayout";

export function evaluateTradeAllianceROI(
  observation: Observation,
  strategyState?: StrategyState | null,
  formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
): TradeAllianceROIAdvisorResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const ownPlayer = observation.ownPlayer;
  const economy = observation.economy;
  const diplomacy = observation.diplomacy;
  const formulaKeys = collectFormulaKeys(formulas);
  const ownReadyPortCount = getOwnedReadyUnitCount(economy, "Port");
  const ownFactoryCount = getOwnedUnitCount(economy, "Factory");
  const ownTrainStationCount = countOwnedTrainStations(observation);
  const portsDisabled = arePortsDisabled(observation);
  const alliancesDisabled = observation.configSnapshot.resolved.disableAlliances;

  warnings.push(
    "Exact trade ROI is unavailable from Observation because water connectivity, port-to-port pathing, train-cluster membership, stop count, and realized trade income history are not exposed.",
  );
  warnings.push(
    "Trade-ship opportunity is estimated only from visible port counts, visible partner port levels, relation state, and embargo state; it is not a route-accurate gold forecast.",
  );
  warnings.push(
    "Train upside uses only the verified per-stop payout values. It does not assume any reachable route, connected cluster, or number of stops.",
  );

  if (!ownPlayer || !economy || !diplomacy) {
    reasons.push(
      !ownPlayer
        ? "Own-player state is unavailable."
        : !economy
          ? "Economy state is unavailable."
          : "Diplomacy state is unavailable.",
    );
    return {
      recommendation: "unknown",
      bestPartnerPlayerId: null,
      partnerAssessments: [],
      ownReadyPortCount,
      ownFactoryCount,
      ownTrainStationCount,
      confidence: "unknown",
      formulas: formulaKeys,
      reasons,
      warnings,
    };
  }

  reasons.push(`${ownReadyPortCount} ready owned port(s) are confirmed.`);
  reasons.push(`${ownFactoryCount} owned factor${ownFactoryCount === 1 ? "y" : "ies"} are confirmed.`);
  reasons.push(
    `${ownTrainStationCount} owned structure(s) visibly carrying train stations are confirmed.`,
  );

  if (portsDisabled) {
    reasons.push("Ports are disabled in this lobby, so maritime trade investment is unavailable.");
  }
  if (alliancesDisabled) {
    reasons.push("Alliances are disabled in this lobby, so alliance-based trade weighting cannot improve.");
  }

  const partnerAssessments = diplomacy.players
    .filter((player) => player.isAlive && player.hasSpawned && !player.isDisconnected)
    .map((player) =>
      assessPartner(
        observation,
        player,
        ownReadyPortCount,
        ownFactoryCount,
        ownTrainStationCount,
        portsDisabled,
        alliancesDisabled,
        formulas,
      ),
    )
    .sort(comparePartnerAssessments);

  const bestPartner = partnerAssessments[0] ?? null;

  if (partnerAssessments.length === 0) {
    reasons.push("No live visible partner candidates are available in diplomacy state.");
    return {
      recommendation: portsDisabled ? "deprioritize_trade" : "unknown",
      bestPartnerPlayerId: null,
      partnerAssessments,
      ownReadyPortCount,
      ownFactoryCount,
      ownTrainStationCount,
      confidence: portsDisabled ? "partial" : "unknown",
      formulas: formulaKeys,
      reasons,
      warnings,
    };
  }

  if (bestPartner) {
    reasons.push(
      `${bestPartner.displayName} is the best visible trade candidate on the current partial signal.`,
    );
  }

  if (strategyState?.diplomacy.allianceTradeUpside.reason) {
    reasons.push(strategyState.diplomacy.allianceTradeUpside.reason);
  }

  return {
    recommendation:
      bestPartner?.recommendation ??
      (portsDisabled ? "deprioritize_trade" : "unknown"),
    bestPartnerPlayerId: bestPartner?.partnerPlayerId ?? null,
    partnerAssessments,
    ownReadyPortCount,
    ownFactoryCount,
    ownTrainStationCount,
    confidence: bestPartner?.confidence ?? "unknown",
    formulas: formulaKeys,
    reasons,
    warnings,
  };
}

function assessPartner(
  observation: Observation,
  partner: ObservationDiplomacyPlayer,
  ownReadyPortCount: number,
  ownFactoryCount: number,
  ownTrainStationCount: number,
  portsDisabled: boolean,
  alliancesDisabled: boolean,
  formulas: readonly FormulaRegistryEntry[],
): TradeAlliancePartnerAssessment {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const relation = classifyRelation(partner);
  const embargoed = partner.iEmbargoThem || partner.theyEmbargoMe;
  const visibleReadyPorts = observation.visibleStructures.filter(
    (entity) =>
      entity.ownerPlayerId === partner.playerId &&
      entity.type === "Port" &&
      !entity.isUnderConstruction,
  );
  const visibleReadyPortCount = visibleReadyPorts.length;
  const visiblePartnerPortLevelSum = visibleReadyPorts.reduce(
    (sum, port) => sum + Math.max(0, port.level ?? 0),
    0,
  );
  const trainPerStopUpside = embargoed
    ? 0
    : resolveTrainPerStopUpside(relation, formulas);
  const tradeShipOpportunityScore = estimateTradeShipOpportunityScore(
    visibleReadyPortCount,
    visiblePartnerPortLevelSum,
    relation,
    embargoed,
    portsDisabled,
    formulas,
  );
  const estimatedPartialROI = estimatePartialROI(
    tradeShipOpportunityScore,
    trainPerStopUpside,
    ownReadyPortCount,
    ownFactoryCount,
    ownTrainStationCount,
    visibleReadyPortCount,
    embargoed,
    portsDisabled,
  );
  const recommendation = chooseRecommendation(
    relation,
    embargoed,
    alliancesDisabled,
    portsDisabled,
    ownReadyPortCount,
    ownFactoryCount,
    ownTrainStationCount,
    visibleReadyPortCount,
    estimatedPartialROI,
  );

  reasons.push(
    `${visibleReadyPortCount} visible ready partner port(s) are exposed for ${partner.displayName}.`,
  );
  reasons.push(
    `Visible partner port levels sum to ${formatNumber(visiblePartnerPortLevelSum)}.`,
  );
  reasons.push(
    `Current relation is ${relation}, which matters because trade ships can use non-embargoed players, while friendly ports receive extra weighting in the pinned port-selection logic.`,
  );
  reasons.push(
    `Verified train per-stop upside is ${formatNumber(trainPerStopUpside)} gold for relation ${relation}.`,
  );

  if (ownReadyPortCount === 0 && !portsDisabled && visibleReadyPortCount > 0 && !embargoed) {
    reasons.push(
      "No ready owned port is confirmed, so visible partner ports point first toward enabling maritime trade access.",
    );
  }

  if (ownFactoryCount === 0 && ownReadyPortCount > 0 && visibleReadyPortCount > 0 && !embargoed) {
    reasons.push(
      "Owned factories are absent, so factory-backed train spawning is the main missing internal trade enabler.",
    );
  }

  if (ownTrainStationCount === 0 && ownFactoryCount > 0 && !portsDisabled) {
    warnings.push(
      "No owned visible train stations are confirmed, so train upside may exist in formula terms without a currently observable station network.",
    );
  }

  if (embargoed) {
    warnings.push(
      "Embargo blocks the pinned-source canTrade() gate, so both trade-ship and external train-sharing upside are treated as effectively unavailable with this partner.",
    );
  }

  if (visibleReadyPortCount === 0) {
    warnings.push(
      "No ready partner port is currently visible, so the partial ROI estimate is based on missing visible destinations and remains weak.",
    );
  }

  if (portsDisabled) {
    warnings.push(
      "Ports are disabled in this lobby, so any maritime trade recommendation is suppressed regardless of visible partner ports.",
    );
  }

  return {
    partnerPlayerId: partner.playerId,
    displayName: partner.displayName,
    relation,
    embargoed,
    visibleReadyPortCount,
    visiblePartnerPortLevelSum,
    estimatedTradeShipOpportunityScore: tradeShipOpportunityScore,
    estimatedTrainPerStopUpside: trainPerStopUpside,
    estimatedPartialROI,
    recommendation,
    confidence:
      visibleReadyPortCount > 0 || embargoed || portsDisabled ? "partial" : "unknown",
    formulas: collectFormulaKeys(formulas),
    reasons,
    warnings,
  };
}

function estimateTradeShipOpportunityScore(
  visibleReadyPortCount: number,
  visiblePartnerPortLevelSum: number,
  relation: TradeAllianceRelation,
  embargoed: boolean,
  portsDisabled: boolean,
  formulas: readonly FormulaRegistryEntry[],
): number {
  if (portsDisabled || embargoed || visibleReadyPortCount === 0) {
    return 0;
  }

  const portFormula = resolveFormulaEntry(PORT_AND_TRADE_SHIPS_FORMULA_KEY, formulas);
  const friendlyBonusMultiplier = relation === "team" || relation === "ally" ? 1.25 : 1;
  const levelWeightedDestinations = visiblePartnerPortLevelSum * 12;
  const countWeightedDestinations = visibleReadyPortCount * 40;
  const verifiedPortFormulaBonus = portFormula?.status === "verified" ? 10 : 0;
  return roundScore(
    (levelWeightedDestinations + countWeightedDestinations + verifiedPortFormulaBonus) *
      friendlyBonusMultiplier,
  );
}

function estimatePartialROI(
  tradeShipOpportunityScore: number,
  trainPerStopUpside: number,
  ownReadyPortCount: number,
  ownFactoryCount: number,
  ownTrainStationCount: number,
  visibleReadyPortCount: number,
  embargoed: boolean,
  portsDisabled: boolean,
): number {
  if (portsDisabled || embargoed) {
    return 0;
  }

  const maritimeEnabled = ownReadyPortCount > 0 && visibleReadyPortCount > 0;
  const trainEnabled = ownFactoryCount > 0 && ownTrainStationCount > 0;
  const maritimeScore = maritimeEnabled ? tradeShipOpportunityScore : tradeShipOpportunityScore * 0.55;
  const trainScore = trainEnabled ? trainPerStopUpside / 1_000 : 0;
  return roundScore(maritimeScore + trainScore);
}

function chooseRecommendation(
  relation: TradeAllianceRelation,
  embargoed: boolean,
  alliancesDisabled: boolean,
  portsDisabled: boolean,
  ownReadyPortCount: number,
  ownFactoryCount: number,
  ownTrainStationCount: number,
  visibleReadyPortCount: number,
  estimatedPartialROI: number,
): TradeAllianceRecommendation {
  if (portsDisabled) {
    return visibleReadyPortCount > 0 ? "deprioritize_trade" : "unknown";
  }

  if (embargoed) {
    return "deprioritize_trade";
  }

  if (visibleReadyPortCount === 0) {
    return ownReadyPortCount > 0 ? "deprioritize_trade" : "unknown";
  }

  if (ownReadyPortCount === 0) {
    return "build_port";
  }

  if (
    !alliancesDisabled &&
    (relation === "other" || relation === "friendly") &&
    estimatedPartialROI > 0
  ) {
    return "ally_for_trade";
  }

  if (ownFactoryCount === 0) {
    return "build_factory";
  }

  if (estimatedPartialROI >= 100) {
    return "upgrade_port";
  }

  if (estimatedPartialROI > 0) {
    return "maintain_trade";
  }

  return "deprioritize_trade";
}

function resolveTrainPerStopUpside(
  relation: TradeAllianceRelation,
  formulas: readonly FormulaRegistryEntry[],
): number {
  const trainFormula = resolveFormulaEntry(TRAIN_PAYOUT_FORMULA_KEY, formulas);
  const values = trainFormula?.values;
  if (!values) {
    return 0;
  }

  switch (relation) {
    case "team":
      return numberValue(values.teamBaseGold);
    case "ally":
      return numberValue(values.allyBaseGold);
    case "friendly":
    case "other":
      return numberValue(values.otherBaseGold);
    default:
      return 0;
  }
}

function arePortsDisabled(observation: Observation): boolean {
  const publicModifiers = observation.configSnapshot.rawGameConfig.publicGameModifiers;
  const disabledUnits = new Set(observation.configSnapshot.rawGameConfig.disabledUnits);
  return publicModifiers?.isPortsDisabled === true || disabledUnits.has("Port");
}

function classifyRelation(player: ObservationDiplomacyPlayer): TradeAllianceRelation {
  if (player.isOnSameTeamAsMe) {
    return "team";
  }
  if (player.isAlliedWithMe) {
    return "ally";
  }
  if (player.isFriendlyToMe) {
    return "friendly";
  }
  return "other";
}

function countOwnedTrainStations(observation: Observation): number {
  const ownPlayerId = observation.ownPlayer?.playerId;
  if (!ownPlayerId) {
    return 0;
  }

  return observation.visibleStructures.filter(
    (entity) =>
      entity.ownerPlayerId === ownPlayerId &&
      entity.hasTrainStation === true &&
      !entity.isUnderConstruction,
  ).length;
}

function getOwnedUnitCount(
  economy: Observation["economy"],
  unitType: string,
): number {
  return economy?.ownedUnitCounts.find((entry) => entry.type === unitType)?.count ?? 0;
}

function getOwnedReadyUnitCount(
  economy: Observation["economy"],
  unitType: string,
): number {
  return economy?.ownedUnitCounts.find((entry) => entry.type === unitType)?.readyCount ?? 0;
}

function resolveFormulaEntry(
  key: string,
  formulas: readonly FormulaRegistryEntry[],
): FormulaRegistryEntry | null {
  return formulas.find((entry) => entry.key === key) ?? getFormulaRegistryEntry(key) ?? null;
}

function collectFormulaKeys(formulas: readonly FormulaRegistryEntry[]): string[] {
  return [
    resolveFormulaEntry(PORT_AND_TRADE_SHIPS_FORMULA_KEY, formulas)?.key,
    resolveFormulaEntry(TRAIN_PAYOUT_FORMULA_KEY, formulas)?.key,
  ].filter((key): key is string => typeof key === "string");
}

function comparePartnerAssessments(
  left: TradeAlliancePartnerAssessment,
  right: TradeAlliancePartnerAssessment,
): number {
  if ((right.estimatedPartialROI ?? -1) !== (left.estimatedPartialROI ?? -1)) {
    return (right.estimatedPartialROI ?? -1) - (left.estimatedPartialROI ?? -1);
  }
  if (right.visibleReadyPortCount !== left.visibleReadyPortCount) {
    return right.visibleReadyPortCount - left.visibleReadyPortCount;
  }
  if (right.visiblePartnerPortLevelSum !== left.visiblePartnerPortLevelSum) {
    return right.visiblePartnerPortLevelSum - left.visiblePartnerPortLevelSum;
  }
  return left.partnerPlayerId.localeCompare(right.partnerPlayerId);
}

function numberValue(value: number | string | boolean | undefined): number {
  return typeof value === "number" ? value : 0;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : String(value);
}
