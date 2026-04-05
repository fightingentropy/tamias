import { roundCurrency } from "@tamias/compliance";
import type {
  CloseCompanyLoansScheduleRecord,
  CorporationTaxRateScheduleRecord,
  FilingProfileRecord,
  YearEndPackRecord,
} from "../../convex";
import { getSummaryAmount, parsePackArray } from "./formatting";
import { evaluateYearEndFilingReadiness } from "./readiness";
import type {
  CorporationTaxSummary,
  RetainedEarningsRollforward,
  SummaryLine,
  WorkingPaperSection,
} from "./types";

function getWorkingPaperSection(
  workingPapers: WorkingPaperSection[],
  key: WorkingPaperSection["key"],
) {
  return workingPapers.find((section) => section.key === key) ?? null;
}

function getWorkingPaperLineAmount(
  section: WorkingPaperSection | null,
  accountCode: string,
) {
  return (
    section?.lines.find((line) => line.accountCode === accountCode)?.balance ??
    0
  );
}

function parseDraftPackData(pack: YearEndPackRecord) {
  const profitAndLoss = parsePackArray<SummaryLine>(pack.profitAndLoss);
  const balanceSheet = parsePackArray<SummaryLine>(pack.balanceSheet);
  const workingPapers = parsePackArray<WorkingPaperSection>(pack.workingPapers);
  const retainedEarnings = (pack
    .retainedEarnings as RetainedEarningsRollforward | null) ?? {
    openingBalance: 0,
    currentPeriodProfit: 0,
    manualEquityAdjustments: 0,
    closingBalance: 0,
  };
  const corporationTax =
    (pack.corporationTax as CorporationTaxSummary | null) ?? null;

  return {
    profitAndLoss,
    balanceSheet,
    workingPapers,
    retainedEarnings,
    corporationTax,
  };
}

export function buildYearEndDraftEvaluation(args: {
  profile: FilingProfileRecord;
  pack: YearEndPackRecord;
  closeCompanyLoansSchedule?: CloseCompanyLoansScheduleRecord | null;
  corporationTaxRateSchedule?: CorporationTaxRateScheduleRecord | null;
}) {
  const parsed = parseDraftPackData(args.pack);
  const equitySection = getWorkingPaperSection(parsed.workingPapers, "equity");
  const debtSection = getWorkingPaperSection(parsed.workingPapers, "debt");
  const shareCapital = getWorkingPaperLineAmount(equitySection, "3000");
  const retainedReserve = parsed.retainedEarnings.closingBalance;
  const assets = getSummaryAmount(parsed.balanceSheet, "assets");
  const liabilities = getSummaryAmount(parsed.balanceSheet, "liabilities");
  const balanceSheetEquity = getSummaryAmount(parsed.balanceSheet, "equity");
  const otherReserves = roundCurrency(
    balanceSheetEquity - shareCapital - retainedReserve,
  );
  const totalEquity = roundCurrency(
    shareCapital + retainedReserve + otherReserves,
  );
  const netAssets = roundCurrency(assets - liabilities);
  const accountingProfitBeforeTax =
    parsed.corporationTax?.accountingProfitBeforeTax ??
    getSummaryAmount(parsed.profitAndLoss, "profit_before_tax");
  const evaluation = evaluateYearEndFilingReadiness({
    profile: args.profile,
    pack: args.pack,
    closeCompanyLoansSchedule: args.closeCompanyLoansSchedule,
    corporationTaxRateSchedule: args.corporationTaxRateSchedule,
    shareCapitalFromLedger: shareCapital,
    balanceSheetEquity,
    totalEquity,
    netAssets,
    debtBalance: debtSection?.total ?? 0,
    accountingProfitBeforeTax,
    corporationTax: parsed.corporationTax,
  });

  return {
    ...parsed,
    shareCapital,
    retainedReserve,
    assets,
    liabilities,
    balanceSheetEquity,
    otherReserves,
    totalEquity,
    netAssets,
    accountingProfitBeforeTax,
    debtBalance: debtSection?.total ?? 0,
    evaluation,
  };
}
