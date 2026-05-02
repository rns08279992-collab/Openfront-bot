import { describe, expect, it } from "vitest";
import { buildTerrainCostMap } from "../TerrainCostMap";
import {
  makeDiplomacyPlayer,
  makeObservation,
  makeTile,
} from "./advisor-fixtures";

describe("buildTerrainCostMap", () => {
  it("returns no tiles when ownPlayer is missing", () => {
    const result = buildTerrainCostMap(
      makeObservation({
        ownPlayer: null,
      }),
    );

    expect(result.tiles).toEqual([]);
    expect(result.warnings).toContain("Own-player state is unavailable.");
  });

  it("returns no tiles when frontiers are missing", () => {
    const result = buildTerrainCostMap(
      makeObservation({
        frontiers: null,
      }),
    );

    expect(result.tiles).toEqual([]);
    expect(result.warnings).toContain("Frontier data is unavailable.");
  });

  it("keeps hostile frontier terrain and coverage unknown with partial confidence", () => {
    const result = buildTerrainCostMap(
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
              tilesOwned: 8,
              troops: 400,
            }),
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

    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]).toMatchObject({
      tileRef: 40,
      ownerPlayerId: "HOST0001",
      terrainMultiplier: null,
      defensePostCoverageMultiplier: null,
      confidence: "partial",
    });
  });

  it("marks neutral frontier tiles with null owner and unknown confidence", () => {
    const result = buildTerrainCostMap(
      makeObservation({
        frontiers: {
          ownBorderTileRefs: [9],
          ownBorderTileCount: 1,
          adjacentPlayerIds: [],
          adjacentFriendlyPlayerIds: [],
          adjacentHostilePlayerIds: [],
          adjacentFriendlyPlayers: [],
          adjacentHostilePlayers: [],
          nearbyFrontierTileRefs: [22],
          nearbyFrontierTiles: [makeTile(22, 2, 2)],
          cheapExpansionCandidates: [],
        },
      }),
    );

    expect(result.tiles).toHaveLength(1);
    expect(result.tiles[0]).toMatchObject({
      tileRef: 22,
      ownerPlayerId: null,
      confidence: "unknown",
    });
  });
});
