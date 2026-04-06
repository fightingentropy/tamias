import { roundCurrency } from "@tamias/compliance";
import {
  deleteCorporationTaxRateScheduleInConvex,
  upsertCorporationTaxRateScheduleInConvex,
  type CurrentUserIdentityRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getYearEndMutationContext, rebuildYearEndMutationPack } from "./common";

export async function upsertCorporationTaxRateSchedule(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
    exemptDistributions: number | null;
    associatedCompaniesThisPeriod: number | null;
    associatedCompaniesFirstYear: number | null;
    associatedCompaniesSecondYear: number | null;
  },
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await upsertCorporationTaxRateScheduleInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    exemptDistributions:
      params.exemptDistributions == null ? null : roundCurrency(params.exemptDistributions),
    associatedCompaniesThisPeriod:
      params.associatedCompaniesThisPeriod == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesThisPeriod)),
    associatedCompaniesFirstYear:
      params.associatedCompaniesFirstYear == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesFirstYear)),
    associatedCompaniesSecondYear:
      params.associatedCompaniesSecondYear == null
        ? null
        : Math.max(0, Math.trunc(params.associatedCompaniesSecondYear)),
    createdBy: params.createdBy,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCorporationTaxRateSchedule(
  db: Database,
  params: {
    teamId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await deleteCorporationTaxRateScheduleInConvex({
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
