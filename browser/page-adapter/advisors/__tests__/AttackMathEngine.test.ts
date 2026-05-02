import { describe, expect, it } from "vitest";
import { evaluateAttackMath } from "../AttackMathEngine";
import { makeDiplomacyPlayer, makeObservation } from "./advisor-fixtures";

describe("evaluateAttackMath", () => {
  it("returns no_attack when ownPlayer is missing", () => {
    const result = evaluateAttackMath(
      makeObservation({
        ownPlayer: null,
      }),
      "HOST0001",
    );

    expect(result.mode).toBe("no_attack");
    expect(result.reasons).toContain("Own-player state is unavailable.");
  });

  it("returns no_attack when frontiers are missing", () => {
    const result = evaluateAttackMath(
      makeObservation({
        frontiers: null,
        diplomacy: {
          allyPlayerIds: [],
          targetPlayerIds: [],
          outgoingAllianceRequestPlayerIds: [],
          embargoedPlayerIds: [],
          embargoedByPlayerIds: [],
          activeAlliances: [],
          players: [makeDiplomacyPlayer("HOST0001")],
        },
      }),
      "HOST0001",
    );

    expect(result.mode).toBe("no_attack");
    expect(result.reasons).toContain(
      "No known hostile frontier tiles are exposed for the target player.",
    );
  });
});
