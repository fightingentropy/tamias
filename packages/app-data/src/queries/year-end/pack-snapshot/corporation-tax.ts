import { roundCurrency } from "@tamias/compliance";
import type { CorporationTaxAdjustmentRecord } from "@tamias/app-data-convex";
import type { AnnualPeriod, CorporationTaxSummary, SummaryLine } from "../types";
import { buildCorporationTaxRateSummary } from "../tax";

export function buildCorporationTaxSummary(
  period: AnnualPeriod,
  profitAndLoss: SummaryLine[],
  adjustments: CorporationTaxAdjustmentRecord[],
  rateSchedule?: import("@tamias/app-data-convex").CorporationTaxRateScheduleRecord | null,
): CorporationTaxSummary {
  const accountingProfitBeforeTax =
    profitAndLoss.find((line) => line.key === "profit_before_tax")?.amount ?? 0;
  const manualAdjustmentsTotal = roundCurrency(
    adjustments.reduce((total, adjustment) => total + adjustment.amount, 0),
  );
  const taxableProfit = roundCurrency(accountingProfitBeforeTax + manualAdjustmentsTotal);
  const rateSummary = buildCorporationTaxRateSummary({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    chargeableProfits: taxableProfit,
    rateSchedule,
  });

  return {
    accountingProfitBeforeTax,
    manualAdjustmentsTotal,
    taxableProfit,
    estimatedTaxRate: rateSummary.effectiveTaxRate,
    estimatedCorporationTaxDue: rateSummary.netCorporationTaxDue,
    grossCorporationTaxDue: rateSummary.grossCorporationTaxDue,
    marginalRelief: rateSummary.marginalRelief,
    exemptDistributions: rateSummary.exemptDistributions,
    augmentedProfits: rateSummary.augmentedProfits,
    startingOrSmallCompaniesRate: rateSummary.startingOrSmallCompaniesRate,
    associatedCompaniesMode: rateSummary.associatedCompaniesMode,
    associatedCompaniesThisPeriod: rateSummary.associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear: rateSummary.associatedCompaniesFirstYear,
    associatedCompaniesSecondYear: rateSummary.associatedCompaniesSecondYear,
    financialYears: rateSummary.financialYears,
    adjustments: adjustments.map((adjustment) => ({
      id: adjustment.id,
      category: adjustment.category,
      label: adjustment.label,
      amount: adjustment.amount,
      note: adjustment.note,
      createdAt: adjustment.createdAt,
    })),
  };
}
