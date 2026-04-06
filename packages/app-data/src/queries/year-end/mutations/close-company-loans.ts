import { roundCurrency } from "@tamias/compliance";
import {
  deleteCloseCompanyLoansScheduleInConvex,
  upsertCloseCompanyLoansScheduleInConvex,
  type CurrentUserIdentityRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getYearEndMutationContext, rebuildYearEndMutationPack } from "./common";

export async function upsertCloseCompanyLoansSchedule(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
    beforeEndPeriod: boolean;
    loansMade: Array<{
      name: string;
      amountOfLoan: number;
    }>;
    taxChargeable: number | null;
    reliefEarlierThan: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefEarlierDue: number | null;
    loanLaterReliefNow: Array<{
      name: string;
      amountRepaid: number | null;
      amountReleasedOrWrittenOff: number | null;
      date: string;
    }>;
    reliefLaterDue: number | null;
    totalLoansOutstanding: number | null;
  },
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await upsertCloseCompanyLoansScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    beforeEndPeriod: params.beforeEndPeriod,
    loansMade: params.loansMade.map((entry) => ({
      name: entry.name.trim(),
      amountOfLoan: Math.round(entry.amountOfLoan),
    })),
    taxChargeable: params.taxChargeable == null ? null : roundCurrency(params.taxChargeable),
    reliefEarlierThan: params.reliefEarlierThan.map((entry) => ({
      name: entry.name.trim(),
      amountRepaid: entry.amountRepaid == null ? null : Math.round(entry.amountRepaid),
      amountReleasedOrWrittenOff:
        entry.amountReleasedOrWrittenOff == null
          ? null
          : Math.round(entry.amountReleasedOrWrittenOff),
      date: entry.date,
    })),
    reliefEarlierDue:
      params.reliefEarlierDue == null ? null : roundCurrency(params.reliefEarlierDue),
    loanLaterReliefNow: params.loanLaterReliefNow.map((entry) => ({
      name: entry.name.trim(),
      amountRepaid: entry.amountRepaid == null ? null : Math.round(entry.amountRepaid),
      amountReleasedOrWrittenOff:
        entry.amountReleasedOrWrittenOff == null
          ? null
          : Math.round(entry.amountReleasedOrWrittenOff),
      date: entry.date,
    })),
    reliefLaterDue: params.reliefLaterDue == null ? null : roundCurrency(params.reliefLaterDue),
    totalLoansOutstanding:
      params.totalLoansOutstanding == null ? null : Math.round(params.totalLoansOutstanding),
    createdBy: params.createdBy,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCloseCompanyLoansSchedule(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await deleteCloseCompanyLoansScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}
