import { describe, expect, it } from "vitest";
import { CopilotController } from "../CopilotController";
import type { CopilotHudSnapshot } from "../CopilotHUD";
import {
  makeObservation,
  makeStrategyState,
} from "../../advisors/__tests__/advisor-fixtures";

describe("CopilotController", () => {
  it("keeps the latest observation and report after rendering a ready snapshot", () => {
    const snapshots: CopilotHudSnapshot[] = [];
    const hud = {
      update(snapshot: CopilotHudSnapshot) {
        snapshots.push(snapshot);
      },
      dispose() {},
    };

    const controller = new CopilotController(hud as never);
    const observation = makeObservation();
    const strategyState = makeStrategyState();

    const report = controller.updateFromObservation(observation, strategyState);
    const latest = controller.latest();

    expect(report).not.toBeNull();
    expect(latest.observation).toBe(observation);
    expect(latest.strategyState).toBe(strategyState);
    expect(latest.report).toBe(report);
    expect(snapshots.at(-1)).toMatchObject({
      status: "ready",
      report,
    });
  });

  it("shows waiting without clearing the last report cache", () => {
    const snapshots: CopilotHudSnapshot[] = [];
    const hud = {
      update(snapshot: CopilotHudSnapshot) {
        snapshots.push(snapshot);
      },
      dispose() {},
    };

    const controller = new CopilotController(hud as never);
    const observation = makeObservation();

    controller.updateFromObservation(observation, makeStrategyState());
    const latestBeforeWaiting = controller.latest();

    controller.showWaiting("runtime unavailable");

    expect(controller.latest()).toEqual(latestBeforeWaiting);
    expect(snapshots.at(-1)).toMatchObject({
      status: "waiting",
      report: null,
      waitingReason: "runtime unavailable",
    });
  });
});
