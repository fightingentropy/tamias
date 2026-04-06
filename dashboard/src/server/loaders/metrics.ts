
import type { SearchParams } from "nuqs/server";
import {
  getPeriodDateRange,
  type PeriodOption,
} from "@/utils/metrics-date-utils";

const DEFAULT_PERIOD: PeriodOption = "1-year";
const DEFAULT_REVENUE_TYPE = "net" as const;

function getFirstValue(value: SearchParams[string]) {
  return Array.isArray(value) ? value[0] : value;
}

function isPeriodOption(
  value: string | null | undefined,
): value is PeriodOption {
  if (!value) {
    return false;
  }

  const validPeriods: PeriodOption[] = [
    "3-months",
    "6-months",
    "this-year",
    "1-year",
    "2-years",
    "5-years",
    "fiscal-year",
    "custom",
  ];

  return validPeriods.includes(value as PeriodOption);
}

function isRevenueType(
  value: string | null | undefined,
): value is "gross" | "net" {
  return value === "gross" || value === "net";
}

export function getInitialMetricsFilter(
  searchParams: SearchParams,
  fiscalYearStartMonth?: number | null,
) {
  const rawPeriod = getFirstValue(searchParams.period);
  const rawRevenueType = getFirstValue(searchParams.revenueType);
  const period: PeriodOption = isPeriodOption(rawPeriod)
    ? rawPeriod
    : DEFAULT_PERIOD;
  const revenueType: "gross" | "net" = isRevenueType(rawRevenueType)
    ? rawRevenueType
    : DEFAULT_REVENUE_TYPE;
  const currency = getFirstValue(searchParams.currency) ?? undefined;
  const explicitFrom = getFirstValue(searchParams.from);
  const explicitTo = getFirstValue(searchParams.to);
  const tab = getFirstValue(searchParams.tab) ?? "overview";

  if (explicitFrom && explicitTo) {
    return {
      tab,
      period,
      revenueType,
      currency,
      from: explicitFrom,
      to: explicitTo,
    };
  }

  const dateRange = getPeriodDateRange(period, fiscalYearStartMonth);

  return {
    tab,
    period,
    revenueType,
    currency,
    from: dateRange.from,
    to: dateRange.to,
  };
}
