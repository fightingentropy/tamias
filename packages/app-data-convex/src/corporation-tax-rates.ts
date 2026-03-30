import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

const apiWithCorporationTaxRateSchedules = api as typeof api & {
  corporationTaxRateSchedules: {
    serviceGetCorporationTaxRateScheduleByPeriod: any;
    serviceUpsertCorporationTaxRateSchedule: any;
    serviceDeleteCorporationTaxRateSchedule: any;
  };
};

export type CorporationTaxRateScheduleRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export async function getCorporationTaxRateScheduleByPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceGetCorporationTaxRateScheduleByPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CorporationTaxRateScheduleRecord | null>;
}

export async function upsertCorporationTaxRateScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  exemptDistributions: number | null;
  associatedCompaniesThisPeriod: number | null;
  associatedCompaniesFirstYear: number | null;
  associatedCompaniesSecondYear: number | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceUpsertCorporationTaxRateSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      exemptDistributions: args.exemptDistributions,
      associatedCompaniesThisPeriod: args.associatedCompaniesThisPeriod,
      associatedCompaniesFirstYear: args.associatedCompaniesFirstYear,
      associatedCompaniesSecondYear: args.associatedCompaniesSecondYear,
      createdBy: args.createdBy,
    }),
  ) as Promise<CorporationTaxRateScheduleRecord>;
}

export async function deleteCorporationTaxRateScheduleInConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().mutation(
    apiWithCorporationTaxRateSchedules.corporationTaxRateSchedules
      .serviceDeleteCorporationTaxRateSchedule,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<{ deleted: boolean }>;
}
