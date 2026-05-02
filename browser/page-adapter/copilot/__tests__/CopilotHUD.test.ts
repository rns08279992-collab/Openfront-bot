import { describe, expect, it } from "vitest";
import { buildCopilotReport } from "../../advisors/CopilotReportBuilder";
import {
  makeDiplomacyPlayer,
  makeObservation,
  makeStrategyState,
  makeTile,
} from "../../advisors/__tests__/advisor-fixtures";
import { buildCopilotHudText } from "../CopilotHUD";

describe("buildCopilotHudText", () => {
  it("shows a waiting message before any observation arrives", () => {
    expect(
      buildCopilotHudText({
        status: "waiting",
        report: null,
      }),
    ).toBe("copilot waiting for observation");
  });

  it("renders the required report sections with visible warnings", () => {
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
            makeDiplomacyPlayer("ALLY0001", {
              displayName: "Ally",
              isFriendlyToMe: true,
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
      makeStrategyState({
        localThreatBand: "low",
        localThreatScore: 20,
      }),
    );

    const text = buildCopilotHudText({
      status: "ready",
      report,
    });

    expect(text).toContain("recommendation:");
    expect(text).toContain("summary:");
    expect(text).toContain("warnings:");
    expect(text).toContain("growth:");
    expect(text).toContain("enclosure:");
    expect(text).toContain("trade:");
    expect(text).toContain("attack:");
  });
});
