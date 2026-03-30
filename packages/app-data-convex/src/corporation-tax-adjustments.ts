import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

const apiWithCorporationTaxAdjustments = api as typeof api & {
  corporationTaxAdjustments: {
    serviceListCorporationTaxAdjustmentsForPeriod: any;
    serviceUpsertCorporationTaxAdjustment: any;
    serviceDeleteCorporationTaxAdjustment: any;
  };
};

export type CorporationTaxAdjustmentRecord = {
  id: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  category: string;
  label: string;
  amount: number;
  note: string | null;
  createdBy: ConvexUserId | null;
  createdAt: string;
  updatedAt: string;
};

export async function listCorporationTaxAdjustmentsForPeriodFromConvex(args: {
  teamId: string;
  filingProfileId: string;
  periodKey: string;
}) {
  return createClient().query(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceListCorporationTaxAdjustmentsForPeriod,
    serviceArgs({
      publicTeamId: args.teamId,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
    }),
  ) as Promise<CorporationTaxAdjustmentRecord[]>;
}

export async function upsertCorporationTaxAdjustmentInConvex(args: {
  id?: string;
  teamId: string;
  filingProfileId: string;
  periodKey: string;
  category?: string;
  label: string;
  amount: number;
  note?: string | null;
  createdBy?: ConvexUserId | null;
}) {
  return createClient().mutation(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceUpsertCorporationTaxAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      corporationTaxAdjustmentId: args.id,
      filingProfileId: args.filingProfileId,
      periodKey: args.periodKey,
      category: args.category,
      label: args.label,
      amount: args.amount,
      note: args.note,
      createdBy: args.createdBy,
    }),
  ) as Promise<CorporationTaxAdjustmentRecord>;
}

export async function deleteCorporationTaxAdjustmentInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    apiWithCorporationTaxAdjustments.corporationTaxAdjustments
      .serviceDeleteCorporationTaxAdjustment,
    serviceArgs({
      publicTeamId: args.teamId,
      corporationTaxAdjustmentId: args.id,
    }),
  ) as Promise<{ deleted: boolean }>;
}
