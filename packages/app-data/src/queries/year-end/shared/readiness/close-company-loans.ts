import type { CloseCompanyLoansScheduleRecord } from "@tamias/app-data-convex";
import { addDays, addMonths, endOfMonth, isValid, parseISO } from "date-fns";
import { coerceDate } from "../formatting";
import { buildCt600aSupplement } from "../tax";
import type { Ct600aSupplement } from "../types";

export function validateCloseCompanyLoansSchedule(args: {
  schedule: CloseCompanyLoansScheduleRecord | null | undefined;
  periodEnd: string;
}) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const schedule = args.schedule;

  if (!schedule) {
    return {
      blockers,
      warnings,
      supplement: null as Ct600aSupplement | null,
    };
  }

  const supplement = buildCt600aSupplement(schedule);

  if (!supplement) {
    return {
      blockers,
      warnings,
      supplement: null as Ct600aSupplement | null,
    };
  }

  const periodEnd = parseISO(args.periodEnd);
  const periodEndAtMonthEnd =
    endOfMonth(periodEnd).getTime() === periodEnd.getTime();
  const today = coerceDate(new Date());
  const earlierUpperBoundExclusive = periodEndAtMonthEnd
    ? addDays(endOfMonth(addMonths(periodEnd, 9)), 1)
    : addDays(addMonths(periodEnd, 9), 1);
  const laterLowerBound = periodEndAtMonthEnd
    ? endOfMonth(addMonths(periodEnd, 9))
    : addMonths(periodEnd, 9);

  if (schedule.loansMade.length > 0) {
    if (schedule.taxChargeable == null || schedule.taxChargeable <= 0) {
      blockers.push(
        "CT600A Part 1 needs a tax chargeable amount greater than zero when outstanding close-company loans are entered.",
      );
    }
  } else if (schedule.taxChargeable != null) {
    blockers.push(
      "CT600A tax chargeable cannot be recorded unless Part 1 outstanding loans are entered.",
    );
  }

  if (schedule.reliefEarlierThan.length > 0) {
    if (!schedule.loansMade.length) {
      blockers.push(
        "CT600A Part 2 relief within 9 months requires Part 1 outstanding loans to be completed.",
      );
    }

    if (schedule.reliefEarlierDue == null || schedule.reliefEarlierDue <= 0) {
      blockers.push(
        "CT600A Part 2 needs a relief due amount greater than zero when repayment or release entries are entered.",
      );
    }
  } else if (schedule.reliefEarlierDue != null) {
    blockers.push(
      "CT600A Part 2 relief due cannot be recorded unless Part 2 loan entries are entered.",
    );
  }

  if (schedule.loanLaterReliefNow.length > 0) {
    if (schedule.reliefLaterDue == null || schedule.reliefLaterDue <= 0) {
      blockers.push(
        "CT600A Part 3 needs a relief due amount greater than zero when later relief entries are entered.",
      );
    }
  } else if (schedule.reliefLaterDue != null) {
    blockers.push(
      "CT600A Part 3 relief due cannot be recorded unless Part 3 loan entries are entered.",
    );
  }

  if (
    schedule.taxChargeable != null &&
    schedule.reliefEarlierDue != null &&
    schedule.reliefEarlierDue > schedule.taxChargeable
  ) {
    blockers.push(
      "CT600A Part 2 relief due must not exceed the Part 1 tax chargeable amount.",
    );
  }

  if (
    schedule.taxChargeable != null &&
    schedule.reliefLaterDue != null &&
    schedule.reliefLaterDue > schedule.taxChargeable
  ) {
    blockers.push(
      "CT600A Part 3 relief due must not exceed the Part 1 tax chargeable amount.",
    );
  }

  for (const entry of schedule.reliefEarlierThan) {
    const date = parseISO(entry.date);

    if (!isValid(date)) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must be a valid repayment, release, or write-off date.`,
      );
      continue;
    }

    if (date.getTime() <= periodEnd.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must be after the accounting period end.`,
      );
    }

    if (date.getTime() >= earlierUpperBoundExclusive.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} must fall within 9 months of the accounting period end.`,
      );
    }

    if (date.getTime() > today.getTime()) {
      blockers.push(
        `CT600A Part 2 date for ${entry.name} cannot be later than today.`,
      );
    }
  }

  for (const entry of schedule.loanLaterReliefNow) {
    const date = parseISO(entry.date);

    if (!isValid(date)) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} must be a valid repayment, release, or write-off date.`,
      );
      continue;
    }

    if (
      periodEndAtMonthEnd
        ? date.getTime() <= laterLowerBound.getTime()
        : date.getTime() < laterLowerBound.getTime()
    ) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} must fall after the 9 month relief window.`,
      );
    }

    if (date.getTime() > today.getTime()) {
      blockers.push(
        `CT600A Part 3 date for ${entry.name} cannot be later than today.`,
      );
    }
  }

  if (
    schedule.totalLoansOutstanding == null &&
    schedule.loansMade.length === 0 &&
    schedule.reliefEarlierThan.length === 0 &&
    schedule.loanLaterReliefNow.length === 0
  ) {
    warnings.push(
      "A CT600A schedule is saved for the period but does not contain any outstanding-loan or relief rows yet.",
    );
  }

  return {
    blockers,
    warnings,
    supplement,
  };
}
