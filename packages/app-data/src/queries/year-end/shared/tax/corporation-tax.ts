import { roundCurrency } from "@tamias/compliance";
import type { CorporationTaxRateScheduleRecord } from "@tamias/app-data-convex";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { CorporationTaxRateSummary } from "../types";

const PRE_SMALL_PROFITS_MAIN_RATE = 0.19;
const SMALL_PROFITS_MAIN_RATE = 0.25;
const SMALL_PROFITS_RATE = 0.19;
const SMALL_PROFITS_LOWER_LIMIT = 50_000;
const SMALL_PROFITS_UPPER_LIMIT = 250_000;
const SMALL_PROFITS_MARGINAL_RELIEF_FRACTION = 3 / 200;

export function getCorporationTaxFinancialYear(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value) : value;

  return date.getUTCMonth() >= 3 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}

function getCorporationTaxFinancialYearStart(financialYear: number) {
  return new Date(Date.UTC(financialYear, 3, 1));
}

function getCorporationTaxFinancialYearEnd(financialYear: number) {
  return new Date(Date.UTC(financialYear + 1, 2, 31));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inclusiveDayCount(start: Date, end: Date) {
  return differenceInCalendarDays(end, start) + 1;
}

function apportionAmountByDays(total: number, dayCounts: number[]) {
  if (!dayCounts.length) {
    return [] as number[];
  }

  const totalDays = dayCounts.reduce((sum, days) => sum + days, 0);
  let allocated = 0;

  return dayCounts.map((days, index) => {
    if (index === dayCounts.length - 1) {
      return roundCurrency(total - allocated);
    }

    const apportioned = roundCurrency((total * days) / totalDays);
    allocated = roundCurrency(allocated + apportioned);
    return apportioned;
  });
}

export function resolveCorporationTaxFinancialYearSegments(args: {
  periodStart: string;
  periodEnd: string;
}) {
  const periodStart = parseISO(args.periodStart);
  const periodEnd = parseISO(args.periodEnd);
  const startFinancialYear = getCorporationTaxFinancialYear(periodStart);
  const endFinancialYear = getCorporationTaxFinancialYear(periodEnd);
  const segments: Array<{
    financialYear: number;
    periodStart: string;
    periodEnd: string;
    daysInSegment: number;
    daysInFinancialYear: number;
  }> = [];

  for (
    let financialYear = startFinancialYear;
    financialYear <= endFinancialYear;
    financialYear += 1
  ) {
    const financialYearStart = getCorporationTaxFinancialYearStart(financialYear);
    const financialYearEnd = getCorporationTaxFinancialYearEnd(financialYear);
    const segmentStart =
      periodStart.getTime() > financialYearStart.getTime() ? periodStart : financialYearStart;
    const segmentEnd =
      periodEnd.getTime() < financialYearEnd.getTime() ? periodEnd : financialYearEnd;

    if (segmentStart.getTime() > segmentEnd.getTime()) {
      continue;
    }

    segments.push({
      financialYear,
      periodStart: formatIsoDate(segmentStart),
      periodEnd: formatIsoDate(segmentEnd),
      daysInSegment: inclusiveDayCount(segmentStart, segmentEnd),
      daysInFinancialYear: inclusiveDayCount(financialYearStart, financialYearEnd),
    });
  }

  return segments;
}

function resolveCorporationTaxRateScheduleMode(
  schedule: CorporationTaxRateScheduleRecord | null | undefined,
  segmentCount: number,
) {
  if (segmentCount === 0) {
    return "not_applicable" as const;
  }

  if (
    segmentCount > 1 &&
    (schedule?.associatedCompaniesFirstYear != null ||
      schedule?.associatedCompaniesSecondYear != null)
  ) {
    return "financial_years" as const;
  }

  return "this_period" as const;
}

export function buildCorporationTaxRateSummary(args: {
  periodStart: string;
  periodEnd: string;
  chargeableProfits: number;
  rateSchedule?: CorporationTaxRateScheduleRecord | null;
}): CorporationTaxRateSummary {
  const segments = resolveCorporationTaxFinancialYearSegments({
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const chargeableProfits = roundCurrency(Math.max(args.chargeableProfits, 0));
  const exemptDistributions = roundCurrency(
    Math.max(args.rateSchedule?.exemptDistributions ?? 0, 0),
  );
  const usesSmallProfitsRules = segments.some((segment) => segment.financialYear >= 2023);
  const associatedCompaniesMode = usesSmallProfitsRules
    ? resolveCorporationTaxRateScheduleMode(args.rateSchedule, segments.length)
    : ("not_applicable" as const);
  const associatedCompaniesThisPeriod =
    segments.length > 0 && associatedCompaniesMode === "this_period"
      ? (args.rateSchedule?.associatedCompaniesThisPeriod ?? 0)
      : null;
  const associatedCompaniesFirstYear =
    segments.length > 1 && associatedCompaniesMode === "financial_years"
      ? (args.rateSchedule?.associatedCompaniesFirstYear ?? 0)
      : null;
  const associatedCompaniesSecondYear =
    segments.length > 1 && associatedCompaniesMode === "financial_years"
      ? (args.rateSchedule?.associatedCompaniesSecondYear ?? 0)
      : null;
  const apportionedChargeableProfits = apportionAmountByDays(
    chargeableProfits,
    segments.map((segment) => segment.daysInSegment),
  );
  const apportionedExemptDistributions = apportionAmountByDays(
    exemptDistributions,
    segments.map((segment) => segment.daysInSegment),
  );
  const financialYears = segments.map((segment, index) => {
    const associatedCompanies =
      associatedCompaniesMode === "financial_years"
        ? index === 0
          ? (associatedCompaniesFirstYear ?? 0)
          : (associatedCompaniesSecondYear ?? 0)
        : associatedCompaniesMode === "this_period"
          ? (associatedCompaniesThisPeriod ?? 0)
          : null;
    const segmentChargeableProfits = apportionedChargeableProfits[index] ?? 0;
    const segmentExemptDistributions = apportionedExemptDistributions[index] ?? 0;
    const segmentAugmentedProfits = roundCurrency(
      segmentChargeableProfits + segmentExemptDistributions,
    );

    if (segment.financialYear < 2023) {
      const grossCorporationTax = roundCurrency(
        segmentChargeableProfits * PRE_SMALL_PROFITS_MAIN_RATE,
      );

      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit: null,
        upperLimit: null,
        taxRate: roundCurrency(PRE_SMALL_PROFITS_MAIN_RATE * 100),
        grossCorporationTax,
        marginalRelief: 0,
        netCorporationTax: grossCorporationTax,
        chargeType: "flat_main_rate" as const,
      };
    }

    const divisor = Math.max((associatedCompanies ?? 0) + 1, 1);
    const lowerLimit = roundCurrency(
      (SMALL_PROFITS_LOWER_LIMIT * segment.daysInSegment) / segment.daysInFinancialYear / divisor,
    );
    const upperLimit = roundCurrency(
      (SMALL_PROFITS_UPPER_LIMIT * segment.daysInSegment) / segment.daysInFinancialYear / divisor,
    );
    const grossMainRateTax = roundCurrency(segmentChargeableProfits * SMALL_PROFITS_MAIN_RATE);

    if (segmentAugmentedProfits <= lowerLimit) {
      const grossCorporationTax = roundCurrency(segmentChargeableProfits * SMALL_PROFITS_RATE);

      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit,
        upperLimit,
        taxRate: roundCurrency(SMALL_PROFITS_RATE * 100),
        grossCorporationTax,
        marginalRelief: 0,
        netCorporationTax: grossCorporationTax,
        chargeType: "small_profits_rate" as const,
      };
    }

    if (segmentAugmentedProfits > upperLimit) {
      return {
        financialYear: segment.financialYear,
        periodStart: segment.periodStart,
        periodEnd: segment.periodEnd,
        daysInSegment: segment.daysInSegment,
        associatedCompanies,
        chargeableProfits: segmentChargeableProfits,
        augmentedProfits: segmentAugmentedProfits,
        lowerLimit,
        upperLimit,
        taxRate: roundCurrency(SMALL_PROFITS_MAIN_RATE * 100),
        grossCorporationTax: grossMainRateTax,
        marginalRelief: 0,
        netCorporationTax: grossMainRateTax,
        chargeType: "main_rate" as const,
      };
    }

    const marginalRelief = roundCurrency(
      (upperLimit - segmentAugmentedProfits) * SMALL_PROFITS_MARGINAL_RELIEF_FRACTION,
    );

    return {
      financialYear: segment.financialYear,
      periodStart: segment.periodStart,
      periodEnd: segment.periodEnd,
      daysInSegment: segment.daysInSegment,
      associatedCompanies,
      chargeableProfits: segmentChargeableProfits,
      augmentedProfits: segmentAugmentedProfits,
      lowerLimit,
      upperLimit,
      taxRate: roundCurrency(SMALL_PROFITS_MAIN_RATE * 100),
      grossCorporationTax: grossMainRateTax,
      marginalRelief,
      netCorporationTax: roundCurrency(grossMainRateTax - marginalRelief),
      chargeType: "marginal_relief" as const,
    };
  });
  const grossCorporationTaxDue = roundCurrency(
    financialYears.reduce((total, item) => total + item.grossCorporationTax, 0),
  );
  const marginalRelief = roundCurrency(
    financialYears.reduce((total, item) => total + item.marginalRelief, 0),
  );
  const netCorporationTaxDue = roundCurrency(grossCorporationTaxDue - marginalRelief);
  const augmentedProfits = roundCurrency(chargeableProfits + exemptDistributions);
  const effectiveTaxRate =
    chargeableProfits > 0
      ? roundCurrency((netCorporationTaxDue / chargeableProfits) * 100) / 100
      : 0;

  return {
    exemptDistributions,
    augmentedProfits,
    grossCorporationTaxDue,
    marginalRelief,
    netCorporationTaxDue,
    effectiveTaxRate,
    associatedCompaniesMode,
    associatedCompaniesThisPeriod,
    associatedCompaniesFirstYear,
    associatedCompaniesSecondYear,
    startingOrSmallCompaniesRate: financialYears.some(
      (item) => item.chargeType === "small_profits_rate" || item.chargeType === "marginal_relief",
    ),
    financialYears,
  };
}
