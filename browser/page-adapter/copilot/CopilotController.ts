import type { Observation } from "../ObservationAdapter";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type { FormulaRegistryEntry } from "../formulas/FormulaRegistry";
import type { CopilotReport } from "../advisors/AdvisorTypes";
import { FORMULA_REGISTRY } from "../formulas/FormulaRegistry";
import { buildCopilotReport } from "../advisors/CopilotReportBuilder";
import { CopilotHUD } from "./CopilotHUD";

export interface CopilotControllerSnapshot {
  readonly observation: Observation | null;
  readonly strategyState: StrategyState | null;
  readonly report: CopilotReport | null;
}

export class CopilotController {
  readonly hud: CopilotHUD;
  private lastSnapshot: CopilotControllerSnapshot = {
    observation: null,
    strategyState: null,
    report: null,
  };

  constructor(hud: CopilotHUD = new CopilotHUD()) {
    this.hud = hud;
    this.showWaiting();
  }

  updateFromObservation(
    observation: Observation | null | undefined,
    strategyState?: StrategyState | null,
    formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
  ): CopilotReport | null {
    if (!observation) {
      this.showWaiting();
      return null;
    }

    const report = buildCopilotReport(observation, strategyState, formulas);
    this.lastSnapshot = {
      observation,
      strategyState: strategyState ?? null,
      report,
    };
    this.updateFromReport(report);
    return report;
  }

  updateFromReport(report: CopilotReport | null | undefined): void {
    if (!report) {
      this.showWaiting();
      return;
    }

    this.lastSnapshot = {
      ...this.lastSnapshot,
      report,
    };
    this.hud.update({
      status: "ready",
      report,
    });
  }

  showWaiting(reason?: string | null): void {
    if (!this.lastSnapshot.report) {
      this.lastSnapshot = {
        observation: null,
        strategyState: null,
        report: null,
      };
    }

    this.hud.update({
      status: "waiting",
      report: null,
      waitingReason: reason ?? null,
    });
  }

  latest(): CopilotControllerSnapshot {
    return this.lastSnapshot;
  }

  clear(): void {
    this.showWaiting();
  }

  dispose(): void {
    this.hud.dispose();
  }
}
