import {
  countComplianceAdjustmentsByVatReturnIdFromConvex,
  countSourceLinksBySourceTypesFromConvex,
  getLatestVatReturnFromConvex,
  getVatReturnByIdFromConvex,
  getVatReturnByObligationIdFromConvex,
} from "../../../../convex";
import { type VatReturnDraft } from "@tamias/compliance";
import type { Database } from "../../../../client";
import type { GetVatDraftParams } from "../types";

async function readVatReturnDraft(
  db: Database,
  vatReturnId: string,
): Promise<VatReturnDraft | null> {
  void db;

  const draft = await getVatReturnByIdFromConvex({
    id: vatReturnId,
  });

  if (!draft) {
    return null;
  }

  const salesCount = await countSourceLinksBySourceTypesFromConvex({
    teamId: draft.teamId,
    sourceTypes: ["transaction", "invoice", "invoice_refund"],
  });
  const purchaseCount = await countSourceLinksBySourceTypesFromConvex({
    teamId: draft.teamId,
    sourceTypes: ["transaction"],
  });

  return {
    id: draft.id,
    filingProfileId: draft.filingProfileId,
    obligationId: draft.obligationId,
    periodKey: draft.periodKey,
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    status: draft.status,
    currency: draft.currency,
    lines: draft.lines.map((line) => ({
      code: line.code as VatReturnDraft["lines"][number]["code"],
      amount: line.amount,
      label: line.label,
    })),
    netVatDue: draft.netVatDue ?? 0,
    salesCount,
    purchaseCount,
    adjustmentCount: await countComplianceAdjustmentsByVatReturnIdFromConvex({
      teamId: draft.teamId,
      vatReturnId,
    }),
    updatedAt: draft.updatedAt,
  };
}

export async function getVatDraft(
  db: Database,
  params: GetVatDraftParams,
) {
  if (params.vatReturnId) {
    return readVatReturnDraft(db, params.vatReturnId);
  }

  if (params.obligationId) {
    const draft = await getVatReturnByObligationIdFromConvex({
      teamId: params.teamId,
      obligationId: params.obligationId,
    });

    if (draft) {
      return readVatReturnDraft(db, draft.id);
    }
  }

  const latest = await getLatestVatReturnFromConvex({
    teamId: params.teamId,
  });

  return latest ? readVatReturnDraft(db, latest.id) : null;
}
