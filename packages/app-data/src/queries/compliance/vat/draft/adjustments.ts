import { createComplianceAdjustmentInConvex } from "@tamias/app-data-convex";
import type { Database } from "../../../../client";
import type { AddVatAdjustmentParams } from "../types";
import { getDraftContext } from "./context";
import { recalculateVatDraft } from "./recalculate";

export async function addVatAdjustment(db: Database, params: AddVatAdjustmentParams) {
  const context = await getDraftContext(db, {
    teamId: params.teamId,
    obligationId: params.obligationId,
    vatReturnId: params.vatReturnId,
  });

  await createComplianceAdjustmentInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    vatReturnId: params.vatReturnId ?? null,
    obligationId: params.obligationId ?? null,
    effectiveDate: params.effectiveDate,
    lineCode: params.lineCode,
    amount: params.amount,
    reason: params.reason,
    note: params.note ?? null,
    createdBy: params.createdBy,
    meta: null,
  });

  return recalculateVatDraft(db, {
    teamId: params.teamId,
    obligationId: params.obligationId,
    vatReturnId: params.vatReturnId,
  });
}
