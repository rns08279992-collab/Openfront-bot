import type { Observation, ObservationTilePosition } from "../ObservationAdapter";
import type { FormulaRegistryEntry } from "../formulas/FormulaRegistry";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type { ProtocolId } from "../../../shared/protocol/intents";

export type AdvisorConfidence = "verified" | "partial" | "unknown";

export type AttackAdviceMode =
  | "no_attack"
  | "poke"
  | "limited"
  | "breakthrough"
  | "full_send_candidate";

export type AttackRiskBand = "unknown" | "low" | "medium" | "high" | "extreme";

export interface TerrainCostEstimate {
  tileRef: number;
  ownerPlayerId: ProtocolId | null;
  terrainMultiplier: number | null;
  defensePostCoverageMultiplier: number | null;
  botTraitorModifier: number | null;
  largeAttackerModifier: number | null;
  largeDefenderModifier: number | null;
  troopRatioFactor: number | null;
  estimatedAttackerLossPerTile: number | null;
  estimatedDefenderLossPerTile: number | null;
  confidence: AdvisorConfidence;
  reasons: string[];
  warnings: string[];
}

export interface TerrainCostMapResult {
  tiles: TerrainCostEstimate[];
  warnings: string[];
  formulas: string[];
}

export interface AttackMathAssessment {
  targetPlayerId: ProtocolId;
  mode: AttackAdviceMode;
  recommendedTroops: number | null;
  minimumReserve: number | null;
  troopRatioFactor: number | null;
  effectiveAttackCost: number | null;
  defenderBleedRate: number | null;
  expectedRiskBand: AttackRiskBand;
  reasons: string[];
  warnings: string[];
}

export type EnclosureStatus =
  | "none"
  | "inferredOpportunity"
  | "verifiedOpportunity"
  | "unknown";

export interface EnclosureClosingTileCandidate {
  tileRef: number;
  position: ObservationTilePosition | null;
  source: "cheapExpansionCandidate" | "nearbyFrontierTile";
  supportCount: number | null;
  adjacentOwnBorderTileCount: number | null;
  estimatedAttackerLossPerTile: number | null;
  terrainConfidence: AdvisorConfidence;
}

export interface EnclosureOpportunityAssessment {
  targetPlayerId: ProtocolId;
  status: EnclosureStatus;
  tilesToCloseEstimate: number | null;
  candidateClosingTiles: EnclosureClosingTileCandidate[];
  expectedBenefit: string;
  confidence: AdvisorConfidence;
  reasons: string[];
  warnings: string[];
}

export interface AttackMathContext {
  observation: Observation;
  strategyState?: StrategyState | null;
  formulas?: readonly FormulaRegistryEntry[];
}

export interface TilePositionIndex {
  get(tileRef: number): ObservationTilePosition | null;
}

export type GrowthTempoRecommendation =
  | "hold_grow"
  | "attack_spend"
  | "raise_cap"
  | "economy_shift"
  | "unknown";

export type GrowthTempoUrgency = "low" | "medium" | "high" | "critical" | "unknown";

export interface GrowthTempoAssessment {
  currentTroops: number | null;
  maxTroops: number | null;
  troopCapRatio: number | null;
  growthHeadroomPercent: number | null;
  currentTroopIncreasePerTick: number | null;
  nearCapPressure: GrowthTempoUrgency;
  recommendation: GrowthTempoRecommendation;
  urgency: GrowthTempoUrgency;
  reasons: string[];
  warnings: string[];
}
