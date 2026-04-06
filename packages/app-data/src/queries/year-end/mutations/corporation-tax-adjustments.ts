import { roundCurrency } from "@tamias/compliance";
import {
  deleteCorporationTaxAdjustmentInConvex,
  upsertCorporationTaxAdjustmentInConvex,
  type CurrentUserIdentityRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import type { CorporationTaxAdjustmentInput } from "../types";
import { getYearEndMutationContext, rebuildYearEndMutationPack } from "./common";

export async function upsertCorporationTaxAdjustment(
  db: Database,
  params: {
    teamId: string;
    createdBy: CurrentUserIdentityRecord["convexId"];
    periodKey?: string;
  } & CorporationTaxAdjustmentInput,
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await upsertCorporationTaxAdjustmentInConvex({
    id: params.id,
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodKey: context.period.periodKey,
    category: params.category ?? "other",
    label: params.label,
    amount: roundCurrency(params.amount),
    note: params.note ?? null,
    createdBy: params.createdBy,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}

export async function deleteCorporationTaxAdjustment(
  db: Database,
  params: {
    teamId: string;
    adjustmentId: string;
    periodKey?: string;
  },
) {
  const context = await getYearEndMutationContext(db, params.teamId, params.periodKey);

  await deleteCorporationTaxAdjustmentInConvex({
    teamId: params.teamId,
    id: params.adjustmentId,
  });

  return rebuildYearEndMutationPack({
    db,
    teamId: params.teamId,
    periodKey: context.period.periodKey,
  });
}
