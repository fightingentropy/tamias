import type { Database } from "../../../../client";
import { getRequiredVatContext } from "../context";
import { getVatObligationByIdFromD1, getVatReturnByIdFromD1 } from "../d1";
import { listVatObligations } from "../obligations";
import type { ComplianceObligationRecord, RecalculateVatDraftParams } from "../types";
import { buildManualObligation } from "./manual-obligation";

export async function getDraftContext(db: Database, params: RecalculateVatDraftParams) {
  const { team, profile } = await getRequiredVatContext(db, params.teamId);
  let obligation: ComplianceObligationRecord | null = null;

  if (params.obligationId) {
    obligation = await getVatObligationByIdFromD1(db, {
      id: params.obligationId,
    });
  } else if (params.vatReturnId) {
    const existingReturn = await getVatReturnByIdFromD1(db, {
      id: params.vatReturnId,
    });

    if (!existingReturn) {
      throw new Error("VAT return not found");
    }

    if (existingReturn.obligationId) {
      obligation = await getVatObligationByIdFromD1(db, {
        id: existingReturn.obligationId,
      });
    }
  }

  if (!obligation) {
    const obligations = await listVatObligations(db, {
      teamId: params.teamId,
    });

    obligation =
      obligations.find((item) => item.status.toLowerCase() === "open") ?? obligations[0] ?? null;
  }

  return {
    team,
    profile,
    obligation: obligation ?? buildManualObligation(params.teamId, profile.id),
  };
}
