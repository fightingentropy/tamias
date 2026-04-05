import { roundCurrency } from "@tamias/compliance";
import type { CloseCompanyLoansScheduleRecord } from "../../../../convex";
import type { Ct600aReliefSection, Ct600aSupplement } from "../types";

function hasMeaningfulCloseCompanyLoansSchedule(
  schedule: CloseCompanyLoansScheduleRecord | null | undefined,
) {
  if (!schedule) {
    return false;
  }

  return (
    schedule.loansMade.length > 0 ||
    schedule.reliefEarlierThan.length > 0 ||
    schedule.loanLaterReliefNow.length > 0 ||
    schedule.taxChargeable != null ||
    schedule.reliefEarlierDue != null ||
    schedule.reliefLaterDue != null ||
    schedule.totalLoansOutstanding != null
  );
}

function sumCloseCompanyLoanAmounts(
  entries: Array<{
    amountOfLoan: number;
  }>,
) {
  return roundCurrency(
    entries.reduce((total, entry) => total + entry.amountOfLoan, 0),
  );
}

function sumCloseCompanyLoanReliefAmounts(
  entries: Array<{
    amountRepaid: number | null;
    amountReleasedOrWrittenOff: number | null;
  }>,
  key: "amountRepaid" | "amountReleasedOrWrittenOff",
) {
  return roundCurrency(
    entries.reduce((total, entry) => total + (entry[key] ?? 0), 0),
  );
}

function buildCt600aReliefSection(args: {
  entries: CloseCompanyLoansScheduleRecord["reliefEarlierThan"];
  reliefDue: number | null;
}): Ct600aReliefSection | null {
  if (!args.entries.length || args.reliefDue == null || args.reliefDue <= 0) {
    return null;
  }

  const totalAmountRepaid = sumCloseCompanyLoanReliefAmounts(
    args.entries,
    "amountRepaid",
  );
  const totalAmountReleasedOrWritten = sumCloseCompanyLoanReliefAmounts(
    args.entries,
    "amountReleasedOrWrittenOff",
  );
  const totalLoans = roundCurrency(
    totalAmountRepaid + totalAmountReleasedOrWritten,
  );

  return {
    loans: args.entries.map((entry) => ({
      name: entry.name,
      amountRepaid: entry.amountRepaid,
      amountReleasedOrWrittenOff: entry.amountReleasedOrWrittenOff,
      date: entry.date,
    })),
    totalAmountRepaid: totalAmountRepaid > 0 ? totalAmountRepaid : null,
    totalAmountReleasedOrWritten:
      totalAmountReleasedOrWritten > 0 ? totalAmountReleasedOrWritten : null,
    totalLoans,
    reliefDue: roundCurrency(args.reliefDue),
  };
}

export function buildCt600aSupplement(
  schedule: CloseCompanyLoansScheduleRecord | null | undefined,
): Ct600aSupplement | null {
  if (!schedule || !hasMeaningfulCloseCompanyLoansSchedule(schedule)) {
    return null;
  }

  const loansInformation =
    schedule.loansMade.length > 0 &&
    schedule.taxChargeable != null &&
    schedule.taxChargeable > 0
      ? {
          loans: schedule.loansMade.map((entry) => ({
            name: entry.name,
            amountOfLoan: entry.amountOfLoan,
          })),
          totalLoans: sumCloseCompanyLoanAmounts(schedule.loansMade),
          taxChargeable: roundCurrency(schedule.taxChargeable),
        }
      : null;
  const reliefEarlierThan = buildCt600aReliefSection({
    entries: schedule.reliefEarlierThan,
    reliefDue: schedule.reliefEarlierDue,
  });
  const loanLaterReliefNow = buildCt600aReliefSection({
    entries: schedule.loanLaterReliefNow,
    reliefDue: schedule.reliefLaterDue,
  });
  const taxPayable = roundCurrency(
    Math.max(
      (schedule.taxChargeable ?? 0) -
        (schedule.reliefEarlierDue ?? 0) -
        (schedule.reliefLaterDue ?? 0),
      0,
    ),
  );

  return {
    beforeEndPeriod: schedule.beforeEndPeriod,
    loansInformation,
    reliefEarlierThan,
    loanLaterReliefNow,
    totalLoansOutstanding:
      schedule.totalLoansOutstanding != null &&
      schedule.totalLoansOutstanding > 0
        ? schedule.totalLoansOutstanding
        : null,
    taxPayable,
  };
}
