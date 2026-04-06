import type { CorporationTaxRateScheduleRecord } from "@tamias/app-data-convex";
import { parseISO } from "date-fns";
import { SMALL_PROFITS_RATE_START } from "../constants";
import { resolveCorporationTaxFinancialYearSegments } from "../tax";

export function validateCorporationTaxRateSchedule(args: {
  schedule: CorporationTaxRateScheduleRecord | null | undefined;
  periodStart: string;
  periodEnd: string;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const periodEnd = parseISO(args.periodEnd);
  const segments = resolveCorporationTaxFinancialYearSegments({
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
  });
  const periodUsesSmallProfitsRules =
    periodEnd.getTime() >= parseISO(SMALL_PROFITS_RATE_START).getTime();
  const schedule = args.schedule;

  if (!periodUsesSmallProfitsRules) {
    if (
      schedule &&
      (schedule.exemptDistributions != null ||
        schedule.associatedCompaniesThisPeriod != null ||
        schedule.associatedCompaniesFirstYear != null ||
        schedule.associatedCompaniesSecondYear != null)
    ) {
      warnings.push(
        "Saved CT rate inputs are ignored for periods ending before 1 April 2023.",
      );
    }

    return { blockers, warnings };
  }

  if (!schedule) {
    blockers.push(
      "Save the CT rate inputs to confirm associated companies and exempt distributions for the period.",
    );
    warnings.push(
      "Until the CT rate inputs are saved, the draft assumes zero associated companies and zero exempt distributions.",
    );
    return { blockers, warnings };
  }

  const hasThisPeriod = schedule.associatedCompaniesThisPeriod != null;
  const hasFirstYear = schedule.associatedCompaniesFirstYear != null;
  const hasSecondYear = schedule.associatedCompaniesSecondYear != null;

  if (hasThisPeriod && (hasFirstYear || hasSecondYear)) {
    blockers.push(
      "Use either one associated-companies count for the whole period or separate first-year and second-year counts, not both.",
    );
  }

  if (!hasThisPeriod && !hasFirstYear && !hasSecondYear) {
    blockers.push(
      "Enter the number of associated companies for the period, even if the answer is 0.",
    );
  }

  if (!hasThisPeriod && hasFirstYear !== hasSecondYear) {
    blockers.push(
      "When the number of associated companies changes across financial years, enter both the first-year and second-year counts.",
    );
  }

  if (segments.length === 1 && (hasFirstYear || hasSecondYear)) {
    blockers.push(
      "This period falls within one corporation-tax financial year, so use a single associated-companies count for the period.",
    );
  }

  return { blockers, warnings };
}
