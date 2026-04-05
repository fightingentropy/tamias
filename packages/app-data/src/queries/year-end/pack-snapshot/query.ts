import type {
  ComplianceJournalEntryRecord,
  CorporationTaxAdjustmentRecord,
  CorporationTaxRateScheduleRecord,
  ExportBundleRecord,
} from "../../../convex";
import { roundCurrency } from "@tamias/compliance";
import type {
  AnnualPeriod,
  CorporationTaxSummary,
  RetainedEarningsRollforward,
  SummaryLine,
  TrialBalanceLine,
  WorkingPaperSection,
} from "../types";
import { buildCorporationTaxSummary } from "./corporation-tax";
import { buildRetainedEarnings } from "./retained-earnings";
import { buildBalanceSheet, buildProfitAndLoss, buildTrialBalance, buildWorkingPapers } from "./trial-balance";
import { buildSnapshotChecksum } from "./checksum";

function buildYearEndPackSnapshotImpl(args: {
  entries: ComplianceJournalEntryRecord[];
  period: AnnualPeriod;
  adjustments: CorporationTaxAdjustmentRecord[];
  rateSchedule?: CorporationTaxRateScheduleRecord | null;
  exportBundles?: ExportBundleRecord[];
  latestExportedAt?: string | null;
  currency: string;
}): {
  currency: string;
  trialBalance: TrialBalanceLine[];
  profitAndLoss: SummaryLine[];
  balanceSheet: SummaryLine[];
  retainedEarnings: RetainedEarningsRollforward;
  workingPapers: WorkingPaperSection[];
  corporationTax: CorporationTaxSummary;
  exportBundles: ExportBundleRecord[];
  latestExportedAt: string | null;
  status: "draft" | "ready" | "exported";
  snapshotChecksum: string;
} {
  const trialBalance = buildTrialBalance(
    args.entries,
    args.period.periodStart,
    args.period.periodEnd,
  );
  const profitAndLoss = buildProfitAndLoss(trialBalance);
  const retainedEarnings = buildRetainedEarnings(
    args.entries,
    args.period.periodStart,
    args.period.periodEnd,
    profitAndLoss,
  );
  const balanceSheet = buildBalanceSheet(trialBalance, retainedEarnings);
  const workingPapers = buildWorkingPapers(trialBalance);
  const corporationTax = buildCorporationTaxSummary(
    args.period,
    profitAndLoss,
    args.adjustments,
    args.rateSchedule,
  );
  const snapshotPayload = {
    period: args.period,
    currency: args.currency,
    trialBalance,
    profitAndLoss,
    balanceSheet,
    retainedEarnings,
    workingPapers,
    corporationTax,
  };
  const trialBalanceDifference = roundCurrency(
    trialBalance.reduce(
      (total, line) => total + roundCurrency(line.debit - line.credit),
      0,
    ),
  );

  return {
    currency: args.currency,
    trialBalance,
    profitAndLoss,
    balanceSheet,
    retainedEarnings,
    workingPapers,
    corporationTax,
    exportBundles: args.exportBundles ?? [],
    latestExportedAt: args.latestExportedAt ?? null,
    status:
      Math.abs(trialBalanceDifference) > 0.009
        ? "draft"
        : (args.exportBundles?.length ?? 0) > 0
          ? "exported"
          : "ready",
    snapshotChecksum: buildSnapshotChecksum(snapshotPayload),
  };
}

export function buildYearEndPackSnapshot(
  args: Parameters<typeof buildYearEndPackSnapshotImpl>[0],
) {
  return buildYearEndPackSnapshotImpl(args);
}
