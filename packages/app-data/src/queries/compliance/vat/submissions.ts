import { createHash } from "node:crypto";
import {
  assertExternalMutationEnvironment,
  HmrcVatProvider,
  roundCurrency,
} from "@tamias/compliance";
import type { Database } from "../../../client";
import { createSubmissionEvent } from "../../filing-events";
import {
  beginIdempotentOperation,
  completeIdempotentOperation,
  failIdempotentOperation,
  requireIdempotentOperationReconciliation,
} from "../../operational-safety";
import { reuseQueryResult } from "../../../utils/request-cache";
import { getHmrcProvider } from "../shared";
import { getRequiredVatContext } from "./context";
import {
  getEvidencePackByIdFromD1,
  getVatObligationByIdFromD1,
  listVatSubmissionsFromD1,
  markVatReturnAcceptedInD1,
  upsertEvidencePackInD1,
} from "./d1";
import { getVatDraft } from "./draft";
import type {
  EvidencePackRecord,
  GetEvidencePackParams,
  SubmitVatReturnParams,
  VatFilingActorId,
} from "./types";

type VatSubmissionResult = {
  receipt: Awaited<ReturnType<HmrcVatProvider["submitReturn"]>>;
  evidencePack: EvidencePackRecord;
};

async function buildEvidencePack(
  db: Database,
  params: {
    teamId: string;
    filingProfileId: string;
    vatReturnId: string;
    createdBy: VatFilingActorId;
    payload: Record<string, unknown>;
  },
) {
  const checksum = createHash("sha256").update(JSON.stringify(params.payload)).digest("hex");

  return upsertEvidencePackInD1(db, {
    teamId: params.teamId,
    filingProfileId: params.filingProfileId,
    vatReturnId: params.vatReturnId,
    checksum,
    payload: params.payload,
    createdBy: params.createdBy,
  });
}

export async function submitVatReturn(
  db: Database,
  params: SubmitVatReturnParams,
): Promise<VatSubmissionResult> {
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
  const obligation = draft.obligationId
    ? await getVatObligationByIdFromD1(db, { id: draft.obligationId })
    : null;
  const hmrcPeriodKey = (obligation?.externalId ?? draft.periodKey).trim();

  if (hmrcPeriodKey.length !== 4) {
    throw new Error("HMRC VAT submission requires the four-character HMRC obligation period key");
  }

  const requestPayload = {
    periodKey: hmrcPeriodKey,
    vatDueSales: roundCurrency(boxMap.box1 ?? 0),
    vatDueAcquisitions: roundCurrency(boxMap.box2 ?? 0),
    totalVatDue: roundCurrency(boxMap.box3 ?? 0),
    vatReclaimedCurrPeriod: roundCurrency(boxMap.box4 ?? 0),
    netVatDue: Math.abs(roundCurrency(boxMap.box5 ?? 0)),
    totalValueSalesExVAT: Math.round(boxMap.box6 ?? 0),
    totalValuePurchasesExVAT: Math.round(boxMap.box7 ?? 0),
    totalValueGoodsSuppliedExVAT: Math.round(boxMap.box8 ?? 0),
    totalAcquisitionsExVAT: Math.round(boxMap.box9 ?? 0),
    finalised: true,
  };
  assertExternalMutationEnvironment({
    kind: "filing",
    providerEnvironment: providerData.provider.environment,
  });
  const operation = await beginIdempotentOperation(db, {
    teamId: params.teamId,
    scope: "filing.hmrc-vat.submit",
    idempotencyKey: params.idempotencyKey,
    request: {
      vatReturnId: params.vatReturnId,
      environment: providerData.provider.environment,
      payload: requestPayload,
    },
  });
  if (operation.state === "replayed") {
    return operation.result as VatSubmissionResult;
  }

  let providerAttempted = false;
  let providerReceipt: VatSubmissionResult["receipt"] | null = null;
  try {
    providerAttempted = true;
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
    providerReceipt = receipt;
    const submittedAt = new Date().toISOString();

    await markVatReturnAcceptedInD1(db, {
      vatReturnId: params.vatReturnId,
      submittedAt,
      externalSubmissionId:
        receipt.formBundleNumber ?? receipt.chargeRefNumber ?? receipt.processingDate ?? null,
    });

    await createSubmissionEvent(db, {
      teamId: params.teamId,
      filingProfileId: profile.id,
      provider: "hmrc-vat",
      obligationType: "vat",
      vatReturnId: params.vatReturnId,
      status: "accepted",
      eventType: "return_submitted",
      correlationId: receipt.formBundleNumber ?? null,
      requestPayload: { ...requestPayload, idempotencyKey: params.idempotencyKey },
      responsePayload: receipt,
    });

    const evidencePack = await buildEvidencePack(db, {
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
    const result = { receipt, evidencePack };
    await completeIdempotentOperation(db, {
      teamId: params.teamId,
      scope: "filing.hmrc-vat.submit",
      idempotencyKey: params.idempotencyKey,
      leaseToken: operation.leaseToken,
      result,
      audit: {
        actorType: "user",
        actorId: params.submittedBy,
        action: "filing.hmrc-vat.submitted",
        resourceType: "vat_return",
        resourceId: params.vatReturnId,
        confirmationId: params.confirmationId,
        environment: providerData.provider.environment,
        payload: {
          filingProfileId: profile.id,
          periodKey: hmrcPeriodKey,
          externalSubmissionId:
            receipt.formBundleNumber ?? receipt.chargeRefNumber ?? receipt.processingDate ?? null,
        },
      },
      outbox: {
        topic: "filing.hmrc-vat.submitted",
        aggregateType: "vat_return",
        aggregateId: params.vatReturnId,
        payload: { filingProfileId: profile.id, periodKey: hmrcPeriodKey },
      },
    });
    return result;
  } catch (error) {
    if (providerAttempted) {
      await requireIdempotentOperationReconciliation(db, {
        teamId: params.teamId,
        scope: "filing.hmrc-vat.submit",
        idempotencyKey: params.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
        providerResult: providerReceipt ?? {
          outcome: "unknown_after_provider_attempt",
        },
      });
    } else {
      await failIdempotentOperation(db, {
        teamId: params.teamId,
        scope: "filing.hmrc-vat.submit",
        idempotencyKey: params.idempotencyKey,
        leaseToken: operation.leaseToken,
        error,
      });
    }
    throw error;
  }
}

async function listVatSubmissionsImpl(db: Database, params: { teamId: string }) {
  return listVatSubmissionsFromD1(db, {
    teamId: params.teamId,
  });
}

export const listVatSubmissions = reuseQueryResult({
  keyPrefix: "vat-submissions",
  keyFn: (params: { teamId: string }) => params.teamId,
  load: listVatSubmissionsImpl,
});

export async function getEvidencePack(db: Database, params: GetEvidencePackParams) {
  return getEvidencePackByIdFromD1(db, {
    teamId: params.teamId,
    id: params.evidencePackId,
  });
}
