import { describe, expect, it } from "vitest";
import { evaluateEnclosureOpportunities } from "../EnclosureAdvisor";
import {
  makeDiplomacyPlayer,
  makeObservation,
  makeTile,
} from "./advisor-fixtures";

describe("evaluateEnclosureOpportunities", () => {
  it("returns an empty list when frontiers are missing", () => {
    const result = evaluateEnclosureOpportunities(
      makeObservation({
        frontiers: null,
      }),
    );

    expect(result).toEqual([]);
  });

  it("reports inferred opportunities for observed closure paths", () => {
    const result = evaluateEnclosureOpportunities(
      makeObservation({
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [makeDiplomacyPlayer("HOST0001")],
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

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("inferredOpportunity");
    expect(result[0].status).not.toBe("verifiedOpportunity");
  });
});
