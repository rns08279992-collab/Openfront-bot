import { describe, expect, it } from "vitest";
import { evaluateGrowthTempo } from "../GrowthTempoAdvisor";
import {
  makeObservation,
  makeStrategyState,
} from "./advisor-fixtures";

describe("evaluateGrowthTempo", () => {
  it("returns critical near-cap pressure and raise_cap near the troop cap", () => {
    const result = evaluateGrowthTempo(
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
    );

    expect(result.nearCapPressure).toBe("critical");
    expect(result.recommendation).toBe("raise_cap");
  });

  it("does not recommend attack_spend under high threat", () => {
    const result = evaluateGrowthTempo(
      makeObservation({
        ownPlayer: {
          ...makeObservation().ownPlayer!,
          gold: "",
        },
        economy: {
          gold: "",
          troops: 850,
          maxTroops: 1000,
          passiveGoldPerTick: "25",
          troopIncreasePerTick: 6,
          ownedUnitCounts: [],
        },
      }),
      makeStrategyState({
        localThreatBand: "high",
        localThreatScore: 85,
        localThreatReason: "Hostile border pressure is elevated.",
      }),
    );

    expect(result.recommendation).not.toBe("attack_spend");
    expect(result.recommendation).toBe("raise_cap");
  });
});
