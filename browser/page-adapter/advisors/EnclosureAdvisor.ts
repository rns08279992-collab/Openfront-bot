import type {
  Observation,
  ObservationExpansionCandidate,
  ObservationTilePosition,
} from "../ObservationAdapter";
import {
  type EnclosureClosingTileCandidate,
  type EnclosureOpportunityAssessment,
  type TerrainCostEstimate,
} from "./AdvisorTypes";
import { buildTerrainCostMap } from "./TerrainCostMap";

const MAX_CANDIDATE_TILES = 5;

export function evaluateEnclosureOpportunities(
  observation: Observation,
): EnclosureOpportunityAssessment[] {
  const frontiers = observation.frontiers;
  if (!frontiers) {
    return [];
  }

  const terrainMap = buildTerrainCostMap(observation);
  const neutralTerrainByTileRef = new Map<number, TerrainCostEstimate>(
    terrainMap.tiles
      .filter((tile) => tile.ownerPlayerId === null)
      .map((tile) => [tile.tileRef, tile]),
  );
  const cheapCandidatesByTileRef = new Map<number, ObservationExpansionCandidate>(
    frontiers.cheapExpansionCandidates.map((candidate) => [candidate.tile.tileRef, candidate]),
  );
  const nearbyTilePositionByTileRef = new Map(
    frontiers.nearbyFrontierTiles.map((tile) => [tile.tileRef, tile] as const),
  );

  const candidateClosingTiles = collectCandidateClosingTiles(
    frontiers.nearbyFrontierTileRefs,
    cheapCandidatesByTileRef,
    nearbyTilePositionByTileRef,
    neutralTerrainByTileRef,
  );

  return frontiers.adjacentHostilePlayers.map((hostileFrontier) => {
    const reasons: string[] = [];
    const warnings = [...terrainMap.warnings];
    const observedHostileTileCount = hostileFrontier.targetTileRefs.length;
    const hasOwnedBorderRefs = Array.isArray(frontiers.ownBorderTileRefs);
    const hasOwnedBorderCount = frontiers.ownBorderTileCount !== null;
    const hasSupportSignal = candidateClosingTiles.some(
      (candidate) => (candidate.supportCount ?? 0) > 0,
    );

    reasons.push(
      `${observedHostileTileCount} hostile frontier tiles are directly exposed for ${hostileFrontier.playerId}.`,
    );
    reasons.push(
      `${candidateClosingTiles.length} nearby neutral frontier tiles are observable as possible closing tiles.`,
    );
    if (hasSupportSignal) {
      reasons.push(
        "Cheap expansion candidates expose support counts, which provides a partial land-closure signal.",
      );
    }
    if (hasOwnedBorderRefs) {
      reasons.push("Owned border tile references are exposed for the current frontier snapshot.");
    } else if (hasOwnedBorderCount) {
      reasons.push("Owned border tile count is exposed, but per-tile owned border references are missing.");
    }

    warnings.push(
      "Observation does not expose adjacency between hostile target tiles and nearby neutral frontier tiles, so closing tiles cannot be assigned to one target with certainty.",
    );
    warnings.push(
      "Observation does not expose hostile-cluster bounding boxes, which are required by the verified land enclosure rules in pinned source.",
    );
    warnings.push(
      "Observation does not expose whether a candidate cluster touches shore, open water, or the map edge, so coastal/naval pocketing remains inferred only.",
    );
    warnings.push(
      "Observation does not expose a full tile graph, so the one-player surround condition cannot be proven from this snapshot.",
    );

    if (observedHostileTileCount === 0) {
      return {
        targetPlayerId: hostileFrontier.playerId,
        status: "none",
        tilesToCloseEstimate: null,
        candidateClosingTiles: [],
        expectedBenefit: "No hostile frontier tiles are currently exposed for enclosure analysis.",
        confidence: "verified",
        reasons,
        warnings,
      } satisfies EnclosureOpportunityAssessment;
    }

    if (candidateClosingTiles.length === 0) {
      reasons.push("No nearby neutral frontier tiles are exposed as a possible closure path.");
      return {
        targetPlayerId: hostileFrontier.playerId,
        status: "none",
        tilesToCloseEstimate: null,
        candidateClosingTiles: [],
        expectedBenefit: "No observable closure path is currently exposed near this hostile frontier.",
        confidence: hasOwnedBorderRefs || hasOwnedBorderCount ? "partial" : "unknown",
        reasons,
        warnings,
      } satisfies EnclosureOpportunityAssessment;
    }

    if (!hasOwnedBorderRefs && !hasOwnedBorderCount && !hasSupportSignal) {
      warnings.push(
        "Owned-border and support signals are both missing, so even a partial enclosure estimate is not defensible.",
      );
      return {
        targetPlayerId: hostileFrontier.playerId,
        status: "unknown",
        tilesToCloseEstimate: null,
        candidateClosingTiles,
        expectedBenefit:
          "Nearby frontier tiles exist, but observation is too incomplete to estimate a credible closure path.",
        confidence: "unknown",
        reasons,
        warnings,
      } satisfies EnclosureOpportunityAssessment;
    }

    const tilesToCloseEstimate = Math.max(
      1,
      Math.min(
        candidateClosingTiles.length,
        candidateClosingTiles.filter((candidate) => candidate.source === "cheapExpansionCandidate")
          .length || 1,
      ),
    );
    reasons.push(
      "This is treated as an inferred land-closure opportunity because nearby frontier tiles and support signals are observable, but source-backed surround conditions are not.",
    );

    return {
      targetPlayerId: hostileFrontier.playerId,
      status: "inferredOpportunity",
      tilesToCloseEstimate,
      candidateClosingTiles,
      expectedBenefit: `Capturing ${tilesToCloseEstimate} nearby frontier tile(s) could reduce exposed border and possibly isolate ${observedHostileTileCount} observed hostile tile(s) if they complete a land closure.`,
      confidence: "partial",
      reasons,
      warnings,
    } satisfies EnclosureOpportunityAssessment;
  });
}

function collectCandidateClosingTiles(
  nearbyFrontierTileRefs: readonly number[],
  cheapCandidatesByTileRef: ReadonlyMap<number, ObservationExpansionCandidate>,
  nearbyTilePositionByTileRef: ReadonlyMap<number, ObservationTilePosition>,
  neutralTerrainByTileRef: ReadonlyMap<number, TerrainCostEstimate>,
): EnclosureClosingTileCandidate[] {
  const orderedTileRefs = new Set<number>([
    ...cheapCandidatesByTileRef.keys(),
    ...nearbyFrontierTileRefs,
  ]);

  return [...orderedTileRefs]
    .map((tileRef) => {
      const cheapCandidate = cheapCandidatesByTileRef.get(tileRef) ?? null;
      const terrainEstimate = neutralTerrainByTileRef.get(tileRef) ?? null;
      const position =
        cheapCandidate?.tile ??
        nearbyTilePositionByTileRef.get(tileRef) ??
        null;
      return {
        tileRef,
        position,
        source: cheapCandidate ? "cheapExpansionCandidate" : "nearbyFrontierTile",
        supportCount: cheapCandidate?.supportCount ?? null,
        adjacentOwnBorderTileCount:
          cheapCandidate?.adjacentOwnBorderTileRefs.length ?? null,
        estimatedAttackerLossPerTile:
          terrainEstimate?.estimatedAttackerLossPerTile ?? null,
        terrainConfidence: terrainEstimate?.confidence ?? "unknown",
      } satisfies EnclosureClosingTileCandidate;
    })
    .sort((left, right) => {
      const supportDelta = (right.supportCount ?? -1) - (left.supportCount ?? -1);
      if (supportDelta !== 0) {
        return supportDelta;
      }
      const borderDelta =
        (right.adjacentOwnBorderTileCount ?? -1) - (left.adjacentOwnBorderTileCount ?? -1);
      if (borderDelta !== 0) {
        return borderDelta;
      }
      return left.tileRef - right.tileRef;
    })
    .slice(0, MAX_CANDIDATE_TILES);
}
