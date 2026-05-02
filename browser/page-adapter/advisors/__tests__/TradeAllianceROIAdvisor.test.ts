import { describe, expect, it } from "vitest";
import { evaluateTradeAllianceROI } from "../TradeAllianceROIAdvisor";
import type { FormulaRegistryEntry } from "../../formulas/FormulaRegistry";
import {
  makeDiplomacyPlayer,
  makeObservation,
  makeTile,
} from "./advisor-fixtures";

function makePortStructure(
  id: number,
  ownerPlayerId: string,
  level = 2,
) {
  return {
    id,
    type: "Port" as const,
    ownerPlayerId,
    ownerSmallID: ownerPlayerId === "OWN00001" ? 1 : 2,
    position: makeTile(id, id, 0),
    troops: 0,
    level,
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
  };
}

function makeTradeFormulas(
  overrides: Partial<FormulaRegistryEntry["values"]> = {},
): FormulaRegistryEntry[] {
  return [
    {
      key: "economy.portAndTradeShips",
      status: "verified",
      summary: "fixture",
      sources: [],
      values: {},
      notes: [],
    },
    {
      key: "economy.trainPayout",
      status: "verified",
      summary: "fixture",
      sources: [],
      values: {
        teamBaseGold: 11111,
        allyBaseGold: 22222,
        otherBaseGold: 33333,
        ...overrides,
      },
      notes: [],
    },
  ];
}

describe("evaluateTradeAllianceROI", () => {
  it.each([
    {
      label: "economy",
      observation: makeObservation({ economy: null }),
    },
    {
      label: "diplomacy",
      observation: makeObservation({ diplomacy: null }),
    },
  ])("returns unknown when $label is unavailable", ({ observation }) => {
    const result = evaluateTradeAllianceROI(observation);

    expect(result.recommendation).toBe("unknown");
    expect(result.confidence).toBe("unknown");
    expect(result.reasons.some((reason) => reason.includes("unavailable"))).toBe(true);
  });

  it("returns deprioritize_trade with a warning when ports are disabled", () => {
    const result = evaluateTradeAllianceROI(
      makeObservation({
        configSnapshot: {
          rawGameConfig: {
            ...makeObservation().configSnapshot.rawGameConfig,
            publicGameModifiers: {
              isPortsDisabled: true,
            },
          },
          resolved: {
            ...makeObservation().configSnapshot.resolved,
          },
        },
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("ALLY0001", {
              displayName: "Harbor Ally",
              isFriendlyToMe: true,
            }),
          ],
        },
        visibleStructures: [makePortStructure(81, "ALLY0001", 3)],
      }),
    );

    expect(result.recommendation).toBe("deprioritize_trade");
    expect(result.warnings.some((warning) => warning.includes("Trade-ship opportunity"))).toBe(true);
    expect(
      result.partnerAssessments[0]?.warnings.some((warning) => warning.includes("Ports are disabled")),
    ).toBe(true);
  });

  it("recommends build_port when no ready owned port is confirmed but a visible partner port is ready", () => {
    const result = evaluateTradeAllianceROI(
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
              displayName: "Harbor Ally",
              isFriendlyToMe: true,
            }),
          ],
        },
        visibleStructures: [makePortStructure(82, "ALLY0001", 2)],
      }),
    );

    expect(result.recommendation).toBe("build_port");
    expect(result.bestPartnerPlayerId).toBe("ALLY0001");
  });

  it("recommends ally_for_trade when alliances are enabled and a friendly visible partner port is present", () => {
    const result = evaluateTradeAllianceROI(
      makeObservation({
        economy: {
          gold: "5000",
          troops: 1000,
          maxTroops: 1500,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 12,
          ownedUnitCounts: [
            {
              type: "Port",
              count: 1,
              readyCount: 1,
              underConstructionCount: 0,
            },
          ],
        },
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
          makePortStructure(71, "OWN00001", 1),
          makePortStructure(83, "ALLY0001", 3),
        ],
      }),
    );

    expect(result.recommendation).toBe("ally_for_trade");
    expect(result.bestPartnerPlayerId).toBe("ALLY0001");
  });

  it("returns deprioritize_trade for an embargoed partner", () => {
    const result = evaluateTradeAllianceROI(
      makeObservation({
        economy: {
          gold: "5000",
          troops: 1000,
          maxTroops: 1500,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 12,
          ownedUnitCounts: [
            {
              type: "Port",
              count: 1,
              readyCount: 1,
              underConstructionCount: 0,
            },
          ],
        },
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: ["EMB00001"],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("EMB00001", {
              displayName: "Embargoed Port",
              isFriendlyToMe: true,
              iEmbargoThem: true,
            }),
          ],
        },
        visibleStructures: [
          makePortStructure(72, "OWN00001", 1),
          makePortStructure(84, "EMB00001", 3),
        ],
      }),
    );

    expect(result.recommendation).toBe("deprioritize_trade");
    expect(result.partnerAssessments[0]?.embargoed).toBe(true);
  });

  it("uses relation-specific train per-stop upside when the registry exposes distinct values", () => {
    const result = evaluateTradeAllianceROI(
      makeObservation({
        diplomacy: {
          allyPlayerIds: ["ALLY0001"],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [
            makeDiplomacyPlayer("TEAM0001", {
              displayName: "Team Port",
              isOnSameTeamAsMe: true,
              team: 1,
            }),
            makeDiplomacyPlayer("ALLY0001", {
              displayName: "Ally Port",
              isAlliedWithMe: true,
            }),
            makeDiplomacyPlayer("OTHR0001", {
              displayName: "Other Port",
            }),
          ],
        },
      }),
      undefined,
      makeTradeFormulas(),
    );

    const assessments = new Map(
      result.partnerAssessments.map((assessment) => [assessment.partnerPlayerId, assessment]),
    );

    expect(assessments.get("TEAM0001")?.estimatedTrainPerStopUpside).toBe(11111);
    expect(assessments.get("ALLY0001")?.estimatedTrainPerStopUpside).toBe(22222);
    expect(assessments.get("OTHR0001")?.estimatedTrainPerStopUpside).toBe(33333);
  });
});
