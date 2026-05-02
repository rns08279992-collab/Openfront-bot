import type {
  AttackMathAssessment,
  CopilotReport,
  EnclosureOpportunityAssessment,
  TradeAlliancePartnerAssessment,
} from "../advisors/AdvisorTypes";

export interface CopilotHudSnapshot {
  readonly status: "waiting" | "ready";
  readonly report: CopilotReport | null;
  readonly waitingReason?: string | null;
}

const HUD_ELEMENT_ID = "openfront-copilot-hud";

export class CopilotHUD {
  private readonly container: HTMLDivElement;
  private readonly pre: HTMLPreElement;
  private lastSnapshot: CopilotHudSnapshot = {
    status: "waiting",
    report: null,
  };

  constructor(documentRef: Document = document) {
    const existing = documentRef.getElementById(HUD_ELEMENT_ID);
    if (existing instanceof HTMLDivElement) {
      this.container = existing;
      this.pre =
        (existing.querySelector("pre") as HTMLPreElement | null) ??
        this.createPre(existing);
      return;
    }

    this.container = documentRef.createElement("div");
    this.container.id = HUD_ELEMENT_ID;
    this.container.setAttribute("data-openfront-bot", "copilot-hud");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "12px",
      right: "12px",
      zIndex: "2147483647",
      width: "320px",
      maxWidth: "calc(100vw - 24px)",
      maxHeight: "calc(100vh - 24px)",
      overflow: "auto",
      padding: "10px 12px",
      borderRadius: "8px",
      background: "rgba(11, 15, 21, 0.94)",
      color: "#eef4ff",
      border: "1px solid rgba(180, 202, 230, 0.22)",
      boxShadow: "0 10px 28px rgba(0, 0, 0, 0.34)",
      fontFamily:
        "ui-monospace, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace",
      fontSize: "12px",
      lineHeight: "1.4",
      whiteSpace: "pre-wrap",
      pointerEvents: "none",
    } satisfies Partial<CSSStyleDeclaration>);
    this.pre = this.createPre(this.container);

    if (documentRef.body) {
      documentRef.body.appendChild(this.container);
    } else {
      documentRef.addEventListener(
        "DOMContentLoaded",
        () => {
          documentRef.body?.appendChild(this.container);
        },
        { once: true },
      );
    }
  }

  update(snapshot: CopilotHudSnapshot): void {
    this.lastSnapshot = snapshot;
    this.pre.textContent = buildCopilotHudText(snapshot);
  }

  showWaiting(): void {
    this.update({
      status: "waiting",
      report: null,
      waitingReason: null,
    });
  }

  dispose(): void {
    this.container.remove();
  }

  private createPre(container: HTMLElement): HTMLPreElement {
    const pre = container.ownerDocument.createElement("pre");
    Object.assign(pre.style, {
      margin: "0",
      whiteSpace: "pre-wrap",
    } satisfies Partial<CSSStyleDeclaration>);
    container.appendChild(pre);
    return pre;
  }
}

export function buildCopilotHudText(snapshot: CopilotHudSnapshot): string {
  if (snapshot.status !== "ready" || !snapshot.report) {
    return snapshot.waitingReason
      ? `copilot waiting: ${snapshot.waitingReason}`
      : "copilot waiting for observation";
  }

  const report = snapshot.report;
  const recommendation = report.nextBestReadOnlyRecommendation;
  const bestEnclosure = selectBestEnclosure(report.enclosureOpportunities);
  const bestTradePartner = selectBestTradePartner(report);
  const bestAttack = selectBestAttack(report.attackAssessments);
  const warnings = report.topWarnings.slice(0, 3);

  return [
    "copilot",
    `recommendation: ${formatRecommendation(recommendation.category, recommendation.priority)}`,
    `summary: ${formatText(recommendation.summary)}`,
    `warnings: ${formatWarnings(warnings)}`,
    `growth: ${formatGrowthSummary(report)}`,
    `enclosure: ${formatEnclosureSummary(bestEnclosure)}`,
    `trade: ${formatTradeSummary(bestTradePartner, report)}`,
    `attack: ${formatAttackSummary(bestAttack)}`,
  ].join("\n");
}

function formatRecommendation(category: string, priority: string): string {
  return `${formatValue(category)} / ${formatValue(priority)}`;
}

function formatWarnings(warnings: readonly string[]): string {
  if (warnings.length === 0) {
    return "none surfaced";
  }
  return warnings.map((warning) => formatText(warning)).join(" | ");
}

function formatGrowthSummary(report: CopilotReport): string {
  const growth = report.growthTempo;
  return [
    `recommendation=${formatValue(growth.recommendation)}`,
    `urgency=${formatValue(growth.urgency)}`,
    `nearCap=${formatValue(growth.nearCapPressure)}`,
    `headroom=${formatPercent(growth.growthHeadroomPercent)}`,
  ].join(", ");
}

function formatEnclosureSummary(
  bestEnclosure: EnclosureOpportunityAssessment | null,
): string {
  if (!bestEnclosure) {
    return "unknown: no enclosure opportunity surfaced";
  }

  return [
    `status=${formatValue(bestEnclosure.status)}`,
    `target=${formatValue(bestEnclosure.targetPlayerId)}`,
    `tiles=${formatNullableNumber(bestEnclosure.tilesToCloseEstimate)}`,
    `confidence=${formatValue(bestEnclosure.confidence)}`,
  ].join(", ");
}

function formatTradeSummary(
  bestTradePartner: TradeAlliancePartnerAssessment | null,
  report: CopilotReport,
): string {
  const recommendation = formatValue(report.tradeAllianceROI.recommendation);
  if (!bestTradePartner) {
    return `recommendation=${recommendation}, partner=unknown`;
  }

  return [
    `recommendation=${recommendation}`,
    `partner=${formatText(bestTradePartner.displayName)} (${formatValue(bestTradePartner.partnerPlayerId)})`,
    `partnerRecommendation=${formatValue(bestTradePartner.recommendation)}`,
    `confidence=${formatValue(bestTradePartner.confidence)}`,
  ].join(", ");
}

function formatAttackSummary(bestAttack: AttackMathAssessment | null): string {
  if (!bestAttack) {
    return "unknown: no attack assessment surfaced";
  }

  return [
    `mode=${formatValue(bestAttack.mode)}`,
    `risk=${formatValue(bestAttack.expectedRiskBand)}`,
    `target=${formatValue(bestAttack.targetPlayerId)}`,
  ].join(", ");
}

function selectBestEnclosure(
  opportunities: readonly EnclosureOpportunityAssessment[],
): EnclosureOpportunityAssessment | null {
  const ranked = [...opportunities].sort((left, right) => {
    const statusDelta = enclosureRank(right.status) - enclosureRank(left.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return (
      (left.tilesToCloseEstimate ?? Number.MAX_SAFE_INTEGER) -
      (right.tilesToCloseEstimate ?? Number.MAX_SAFE_INTEGER)
    );
  });
  return ranked[0] ?? null;
}

function selectBestTradePartner(
  report: CopilotReport,
): TradeAlliancePartnerAssessment | null {
  const preferredPartnerId = report.tradeAllianceROI.bestPartnerPlayerId;
  if (preferredPartnerId) {
    const matched = report.tradeAllianceROI.partnerAssessments.find(
      (partner) => partner.partnerPlayerId === preferredPartnerId,
    );
    if (matched) {
      return matched;
    }
  }

  const ranked = [...report.tradeAllianceROI.partnerAssessments].sort((left, right) => {
    const roiDelta =
      (right.estimatedPartialROI ?? Number.NEGATIVE_INFINITY) -
      (left.estimatedPartialROI ?? Number.NEGATIVE_INFINITY);
    if (roiDelta !== 0) {
      return roiDelta;
    }
    return left.partnerPlayerId.localeCompare(right.partnerPlayerId);
  });
  return ranked[0] ?? null;
}

function selectBestAttack(
  assessments: readonly AttackMathAssessment[],
): AttackMathAssessment | null {
  const ranked = [...assessments].sort((left, right) => {
    const modeDelta = attackModeRank(right.mode) - attackModeRank(left.mode);
    if (modeDelta !== 0) {
      return modeDelta;
    }
    const riskDelta = attackRiskRank(left.expectedRiskBand) - attackRiskRank(right.expectedRiskBand);
    if (riskDelta !== 0) {
      return riskDelta;
    }
    return left.targetPlayerId.localeCompare(right.targetPlayerId);
  });
  return ranked[0] ?? null;
}

function enclosureRank(status: EnclosureOpportunityAssessment["status"]): number {
  switch (status) {
    case "verifiedOpportunity":
      return 3;
    case "inferredOpportunity":
      return 2;
    case "unknown":
      return 1;
    case "none":
    default:
      return 0;
  }
}

function attackModeRank(mode: AttackMathAssessment["mode"]): number {
  switch (mode) {
    case "full_send_candidate":
      return 4;
    case "breakthrough":
      return 3;
    case "limited":
      return 2;
    case "poke":
      return 1;
    case "no_attack":
    default:
      return 0;
  }
}

function attackRiskRank(risk: AttackMathAssessment["expectedRiskBand"]): number {
  switch (risk) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "extreme":
      return 3;
    case "unknown":
    default:
      return 4;
  }
}

function formatText(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  return value;
}

function formatValue(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }
  if (value === "unknown" || value === "partial") {
    return `${value} (incomplete)`;
  }
  return value;
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "unknown";
  }
  return `${value.toFixed(1)}%`;
}

function formatNullableNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "unknown";
  }
  return String(value);
}
