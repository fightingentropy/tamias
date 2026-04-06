import type { ComplianceObligationRecord } from "@tamias/app-data-convex";
import type { Database } from "../../../../client";
import { getRequiredVatContext } from "../context";
import { listVatObligations } from "../obligations";
import { buildManualObligation } from "./manual-obligation";
import type { RecalculateVatDraftParams } from "../types";

export async function getDraftContext(
  db: Database,
  params: RecalculateVatDraftParams,
) {
  const { team, profile } = await getRequiredVatContext(db, params.teamId);
  let obligation: ComplianceObligationRecord | null = null;

  if (params.obligationId) {
    const { getVatObligationByIdFromConvex } = await import(
      "@tamias/app-data-convex",
    );
    obligation = await getVatObligationByIdFromConvex({
      id: params.obligationId,
    });
  } else if (params.vatReturnId) {
    const { getVatReturnByIdFromConvex, getVatObligationByIdFromConvex } =
      await import("@tamias/app-data-convex");
    const existingReturn = await getVatReturnByIdFromConvex({
      id: params.vatReturnId,
    });

    if (!existingReturn) {
      throw new Error("VAT return not found");
    }

    if (existingReturn.obligationId) {
      obligation = await getVatObligationByIdFromConvex({
        id: existingReturn.obligationId,
      });
    }
  }

  if (!obligation) {
    const obligations = await listVatObligations(db, {
      teamId: params.teamId,
    });

    obligation =
      obligations.find((item) => item.status.toLowerCase() === "open") ??
      obligations[0] ??
      null;
  }

  return {
    team,
    profile,
    obligation:
      obligation ?? buildManualObligation(params.teamId, profile.id),
  };
}
