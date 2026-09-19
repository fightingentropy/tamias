import { currentUkTaxYear } from "@tamias/compliance/self-assessment";
import { getFiscalYearDates } from "@tamias/utils";
import { format, formatISO, parseISO, startOfYear, subMonths, subYears } from "date-fns";

export type PeriodOption =
  | "3-months"
  | "6-months"
  | "this-year"
  | "1-year"
  | "2-years"
  | "5-years"
  | "tax-year"
  | "previous-tax-year"
  | "fiscal-year"
  | "custom";

/**
 * Get display label for a period option
 */
export function getPeriodLabel(period: PeriodOption, from?: string, to?: string): string {
  switch (period) {
    case "3-months":
      return "3 months";
    case "6-months":
      return "6 months";
    case "this-year":
      return "This year";
    case "1-year":
      return "1 year";
    case "2-years":
      return "2 years";
    case "5-years":
      return "5 years";
    case "tax-year":
      return "Current UK tax year";
    case "previous-tax-year":
      return "Previous UK tax year";
    case "fiscal-year":
      return "Fiscal year";
    case "custom":
      if (from && to) {
        const fromDate = parseISO(from);
        const toDate = parseISO(to);
        return `${format(fromDate, "MMM d")} - ${format(toDate, "MMM d, yyyy")}`;
      }
      return "Custom";
    default:
      return "1 year";
  }
}

export function getPeriodDateRange(
  period: PeriodOption,
  fiscalYearStartMonth?: number | null,
  customFrom?: string,
  customTo?: string,
  now = new Date(),
): { from: string; to: string } {
  const to = formatISO(now, { representation: "date" });

  switch (period) {
    case "3-months": {
      const from = subMonths(now, 3);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "6-months": {
      const from = subMonths(now, 6);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "this-year": {
      const from = startOfYear(now);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "1-year": {
      const from = subYears(now, 1);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "2-years": {
      const from = subYears(now, 2);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "5-years": {
      const from = subYears(now, 5);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    case "tax-year":
    case "previous-tax-year": {
      const year = currentUkTaxYear(now) - (period === "previous-tax-year" ? 1 : 0);
      return {
        from: `${year}-04-06`,
        to:
          period === "tax-year"
            ? now.toLocaleDateString("en-CA", { timeZone: "Europe/London" })
            : `${year + 1}-04-05`,
      };
    }
    case "fiscal-year": {
      const { from: fiscalFrom, to: fiscalTo } = getFiscalYearDates(fiscalYearStartMonth, now);
      return {
        from: formatISO(fiscalFrom, { representation: "date" }),
        to: formatISO(fiscalTo, { representation: "date" }),
      };
    }
    case "custom": {
      // Use custom dates if provided, otherwise fall back to 1 year
      if (customFrom && customTo) {
        return { from: customFrom, to: customTo };
      }
      const from = subYears(now, 1);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
    default: {
      // Default to 1 year
      const from = subYears(now, 1);
      return {
        from: formatISO(from, { representation: "date" }),
        to,
      };
    }
  }
}

export function isPeriodOption(value: string | null | undefined): value is PeriodOption {
  return [
    "3-months",
    "6-months",
    "this-year",
    "1-year",
    "2-years",
    "5-years",
    "fiscal-year",
    "tax-year",
    "previous-tax-year",
    "custom",
  ].includes(value ?? "");
}
