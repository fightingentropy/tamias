import { createHash } from "node:crypto";
import { HmrcVatProvider, roundCurrency } from "@tamias/compliance";
import {
  createSubmissionEventInConvex,
  getEvidencePackByIdFromConvex,
  listVatSubmissionsFromConvex,
  markVatReturnAcceptedInConvex,
  upsertEvidencePackInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getHmrcProvider } from "../shared";
import { getRequiredVatContext } from "./context";
import { getVatDraft } from "./draft";
import type { ConvexUserId, GetEvidencePackParams, SubmitVatReturnParams } from "./types";

async function buildEvidencePack(params: {
  teamId: string;
  filingProfileId: string;
  vatReturnId: string;
  createdBy: ConvexUserId;
  payload: Record<string, unknown>;
}) {
  const checksum = createHash("sha256").update(JSON.stringify(params.payload)).digest("hex");

  return upsertEvidencePackInConvex({
    teamId: params.teamId,
    filingProfileId: params.filingProfileId,
    vatReturnId: params.vatReturnId,
    checksum,
    payload: params.payload,
    createdBy: params.createdBy,
  });
}

export async function submitVatReturn(db: Database, params: SubmitVatReturnParams) {
  const { team, profile } = await getRequiredVatContext(db, params.teamId);

  if (!profile.vrn) {
    throw new Error("VAT registration number is required");
  }

  const providerData = await getHmrcProvider(db, params.teamId, profile);

  if (!providerData) {
    throw new Error("HMRC VAT is not connected");
  }

  const draft = await getVatDraft(db, {
    teamId: params.teamId,
    vatReturnId: params.vatReturnId,
  });

  if (!draft) {
    throw new Error("VAT return draft not found");
  }

  if (!params.declarationAccepted) {
    throw new Error("Declaration must be accepted before submission");
  }

  const boxMap = draft.lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.code] = line.amount;
    return acc;
  }, {});
  const requestPayload = {
    periodKey: draft.periodKey,
    vatDueSales: roundCurrency(boxMap.box1 ?? 0),
    vatDueAcquisitions: roundCurrency(boxMap.box2 ?? 0),
    totalVatDue: roundCurrency(boxMap.box3 ?? 0),
    vatReclaimedCurrPeriod: roundCurrency(boxMap.box4 ?? 0),
    netVatDue: roundCurrency(boxMap.box5 ?? 0),
    totalValueSalesExVAT: Math.round(boxMap.box6 ?? 0),
    totalValuePurchasesExVAT: Math.round(boxMap.box7 ?? 0),
    totalValueGoodsSuppliedExVAT: Math.round(boxMap.box8 ?? 0),
    totalAcquisitionsExVAT: Math.round(boxMap.box9 ?? 0),
    finalised: true,
  };
  const receipt = await providerData.provider.submitReturn({
    vrn: profile.vrn,
    submission: requestPayload,
    accessToken: providerData.config.accessToken,
    fraudHeaders: HmrcVatProvider.buildFraudPreventionHeaders({
      deviceId: crypto.randomUUID(),
      userId: params.submittedBy,
      userAgent: params.userAgent,
      publicIp: params.publicIp,
    }),
  });
  const submittedAt = new Date().toISOString();

  await markVatReturnAcceptedInConvex({
    vatReturnId: params.vatReturnId,
    submittedAt,
    externalSubmissionId:
      receipt.formBundleNumber ?? receipt.chargeRefNumber ?? receipt.processingDate ?? null,
  });

  await createSubmissionEventInConvex({
    teamId: params.teamId,
    filingProfileId: profile.id,
    provider: "hmrc-vat",
    obligationType: "vat",
    vatReturnId: params.vatReturnId,
    status: "accepted",
    eventType: "return_submitted",
    correlationId: receipt.formBundleNumber ?? null,
    requestPayload,
    responsePayload: receipt,
  });

  const evidencePack = await buildEvidencePack({
    teamId: params.teamId,
    filingProfileId: profile.id,
    vatReturnId: params.vatReturnId,
    createdBy: params.submittedBy,
    payload: {
      team: {
        id: team.id,
        name: team.name,
      },
      profile,
      draft,
      submission: {
        request: requestPayload,
        response: receipt,
      },
      generatedAt: new Date().toISOString(),
    },
  });

  return {
    receipt,
    evidencePack,
  };
}

async function listVatSubmissionsImpl(db: Database, params: { teamId: string }) {
  void db;

  return listVatSubmissionsFromConvex({
    teamId: params.teamId,
  });
}

export const listVatSubmissions = reuseQueryResult({
  keyPrefix: "vat-submissions",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: listVatSubmissionsImpl,
});

export async function getEvidencePack(params: GetEvidencePackParams) {
  return getEvidencePackByIdFromConvex({
    teamId: params.teamId,
    id: params.evidencePackId,
  });
}
