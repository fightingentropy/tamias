import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

const apiWithCloseCompanyLoansSchedules = api as typeof api & {
  closeCompanyLoansSchedules: {
    serviceGetCloseCompanyLoansScheduleByPeriod: any;
    serviceUpsertCloseCompanyLoansSchedule: any;
    serviceDeleteCloseCompanyLoansSchedule: any;
  };
};

export type CloseCompanyLoansScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
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
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export async function getCloseCompanyLoansScheduleByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceGetCloseCompanyLoansScheduleByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CloseCompanyLoansScheduleRecord | null>;
}

export async function upsertCloseCompanyLoansScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
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
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceUpsertCloseCompanyLoansSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      beforeEndPeriod: args.beforeEndPeriod,
      loansMade: args.loansMade,
      taxChargeable: args.taxChargeable,
      reliefEarlierThan: args.reliefEarlierThan,
      reliefEarlierDue: args.reliefEarlierDue,
      loanLaterReliefNow: args.loanLaterReliefNow,
      reliefLaterDue: args.reliefLaterDue,
      totalLoansOutstanding: args.totalLoansOutstanding,
      createdBy: args.createdBy,
    }),
  ) as Promise<CloseCompanyLoansScheduleRecord>;
}

export async function deleteCloseCompanyLoansScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().mutation(
    apiWithCloseCompanyLoansSchedules.closeCompanyLoansSchedules
      .serviceDeleteCloseCompanyLoansSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<{ deleted: boolean }>;
}
