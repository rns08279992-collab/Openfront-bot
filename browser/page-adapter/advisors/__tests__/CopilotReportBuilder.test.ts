import { describe, expect, it } from "vitest";
import { buildCopilotReport } from "../CopilotReportBuilder";
import {
  makeDiplomacyPlayer,
  makeObservation,
  makeStrategyState,
  makeTile,
} from "./advisor-fixtures";

describe("buildCopilotReport", () => {
  it("limits attack assessments to adjacent hostile players", () => {
    const report = buildCopilotReport(
      makeObservation({
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("HOST0001"),
            makeDiplomacyPlayer("HOST0002"),
          ],
        },
        frontiers: {
          ownBorderTileRefs: [9],
          ownBorderTileCount: 1,
          adjacentPlayerIds: ["HOST0001"],
          adjacentFriendlyPlayerIds: [],
          adjacentHostilePlayerIds: ["HOST0001"],
          adjacentFriendlyPlayers: [],
          adjacentHostilePlayers: [
            {
              playerId: "HOST0001",
              borderTileRefs: [9],
              targetTileRefs: [40],
            },
          ],
          nearbyFrontierTileRefs: [],
          nearbyFrontierTiles: [],
          cheapExpansionCandidates: [],
        },
      }),
    );

    expect(report.attackAssessments).toHaveLength(1);
    expect(report.attackAssessments[0].targetPlayerId).toBe("HOST0001");
  });

  it("surfaces high growth pressure before normal attack pressure when local threat is not high", () => {
    const report = buildCopilotReport(
      makeObservation({
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("HOST0001", {
              troops: 250,
            }),
          ],
        },
        economy: {
          gold: "5000",
          troops: 950,
          maxTroops: 1000,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 4,
          ownedUnitCounts: [],
        },
        frontiers: {
          ownBorderTileRefs: [9],
          ownBorderTileCount: 1,
          adjacentPlayerIds: ["HOST0001"],
          adjacentFriendlyPlayerIds: [],
          adjacentHostilePlayerIds: ["HOST0001"],
          adjacentFriendlyPlayers: [],
          adjacentHostilePlayers: [
            {
              playerId: "HOST0001",
              borderTileRefs: [9],
              targetTileRefs: [40],
            },
          ],
          nearbyFrontierTileRefs: [],
          nearbyFrontierTiles: [],
          cheapExpansionCandidates: [],
        },
      }),
      makeStrategyState({
        localThreatBand: "low",
        localThreatScore: 20,
      }),
    );

    expect(report.nextBestReadOnlyRecommendation.category).toBe("growth");
    expect(report.nextBestReadOnlyRecommendation.priority).toBe("critical");
  });

  it("suppresses growth as the top recommendation when local threat is high", () => {
    const report = buildCopilotReport(
      makeObservation({
        economy: {
          gold: "5000",
          troops: 950,
          maxTroops: 1000,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 4,
          ownedUnitCounts: [],
        },
      }),
      makeStrategyState({
        localThreatBand: "high",
        localThreatScore: 85,
        localThreatReason: "Hostile border pressure is elevated.",
      }),
    );

    expect(report.nextBestReadOnlyRecommendation.category).toBe("defense");
    expect(report.nextBestReadOnlyRecommendation.priority).toBe("high");
  });

  it("lets inferred enclosure opportunities outrank normal attack suggestions", () => {
    const report = buildCopilotReport(
      makeObservation({
        economy: {
          gold: "5000",
          troops: 400,
          maxTroops: 1000,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 10,
          ownedUnitCounts: [],
        },
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("HOST0001", {
              troops: 150,
            }),
          ],
        },
        frontiers: {
          ownBorderTileRefs: [9, 10],
          ownBorderTileCount: 2,
          adjacentPlayerIds: ["HOST0001"],
          adjacentFriendlyPlayerIds: [],
          adjacentHostilePlayerIds: ["HOST0001"],
          adjacentFriendlyPlayers: [],
          adjacentHostilePlayers: [
            {
              playerId: "HOST0001",
              borderTileRefs: [9],
              targetTileRefs: [41],
            },
          ],
          nearbyFrontierTileRefs: [50],
          nearbyFrontierTiles: [makeTile(50, 5, 5)],
          cheapExpansionCandidates: [
            {
              tile: makeTile(50, 5, 5),
              adjacentOwnBorderTileRefs: [9, 10],
              supportCount: 2,
            },
          ],
        },
      }),
    );

    expect(report.nextBestReadOnlyRecommendation.category).toBe("enclosure");
    expect(report.nextBestReadOnlyRecommendation.priority).toBe("high");
  });

  it("does not convert no_attack signals into attack recommendations and can fall through to trade", () => {
    const report = buildCopilotReport(
      makeObservation({
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("ALLY0001", {
              displayName: "Ally",
              isFriendlyToMe: true,
            }),
          ],
        },
        visibleStructures: [
          {
            id: 1,
            type: "Port",
            ownerPlayerId: "ALLY0001",
            ownerSmallID: 2,
            position: makeTile(88, 8, 8),
            troops: 0,
            level: 2,
            health: null,
            isActive: true,
            isUnderConstruction: false,
            isTargetable: null,
            reachedTarget: null,
            targetTile: null,
            markedForDeletionAtTick: null,
            hasTrainStation: false,
            trainType: null,
            isLoaded: null,
          },
        ],
      }),
      makeStrategyState({
        recommendedAttackPosture: "avoid",
      }),
    );

    expect(report.nextBestReadOnlyRecommendation.category).toBe("trade");
    expect(report.nextBestReadOnlyRecommendation.summary).toContain("port");
  });

  it("surfaces trade when growth, combat, and enclosure are not urgent", () => {
    const report = buildCopilotReport(
      makeObservation({
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("ALLY0001", {
              displayName: "Friendly Port",
              isFriendlyToMe: true,
            }),
          ],
        },
        visibleStructures: [
          {
            id: 2,
            type: "Port",
            ownerPlayerId: "ALLY0001",
            ownerSmallID: 2,
            position: makeTile(89, 9, 8),
            troops: 0,
            level: 3,
            health: null,
            isActive: true,
            isUnderConstruction: false,
            isTargetable: null,
            reachedTarget: null,
            targetTile: null,
            markedForDeletionAtTick: null,
            hasTrainStation: false,
            trainType: null,
            isLoaded: null,
          },
        ],
      }),
      makeStrategyState({
        localThreatBand: "low",
        localThreatScore: 10,
        recommendedAttackPosture: "avoid",
        safeAttackWindowActive: false,
        safeAttackWindowScore: 20,
      }),
    );

    expect(report.growthTempo.urgency).not.toBe("high");
    expect(report.growthTempo.urgency).not.toBe("critical");
    expect(report.attackAssessments).toHaveLength(0);
    expect(
      report.enclosureOpportunities.every((opportunity) => opportunity.status === "none"),
    ).toBe(true);
    expect(report.tradeAllianceROI.recommendation).toBe("build_port");
    expect(report.nextBestReadOnlyRecommendation.category).toBe("trade");
  });

  it("preserves unknown fallback when observation is too incomplete", () => {
    const report = buildCopilotReport(
      makeObservation({
        ownPlayer: null,
        economy: null,
        frontiers: null,
        diplomacy: null,
      }),
    );

    expect(report.nextBestReadOnlyRecommendation.category).toBe("unknown");
    expect(report.nextBestReadOnlyRecommendation.priority).toBe("unknown");
    expect(
      report.nextBestReadOnlyRecommendation.reasons.some((reason) =>
        reason.includes("unavailable"),
      ),
    ).toBe(true);
  });
});
