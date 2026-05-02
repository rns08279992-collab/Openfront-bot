import type { Observation } from "../ObservationAdapter";
import type { StrategyState } from "../../../shared/interpreter/strategy-state";
import type { FormulaRegistryEntry } from "../formulas/FormulaRegistry";
import type { CopilotReport } from "../advisors/AdvisorTypes";
import { FORMULA_REGISTRY } from "../formulas/FormulaRegistry";
import { buildCopilotReport } from "../advisors/CopilotReportBuilder";
import { CopilotHUD } from "./CopilotHUD";

export class CopilotController {
  readonly hud: CopilotHUD;

  constructor(hud: CopilotHUD = new CopilotHUD()) {
    this.hud = hud;
    this.hud.showWaiting();
  }

  updateFromObservation(
    observation: Observation | null | undefined,
    strategyState?: StrategyState | null,
    formulas: readonly FormulaRegistryEntry[] = FORMULA_REGISTRY,
  ): CopilotReport | null {
    if (!observation) {
      this.hud.showWaiting();
      return null;
    }

    const report = buildCopilotReport(observation, strategyState, formulas);
    this.updateFromReport(report);
    return report;
  }

  updateFromReport(report: CopilotReport | null | undefined): void {
    if (!report) {
      this.hud.showWaiting();
      return;
    }

    this.hud.update({
      status: "ready",
      report,
    });
  }

  clear(): void {
    this.hud.showWaiting();
  }

  dispose(): void {
    this.hud.dispose();
  }
}
