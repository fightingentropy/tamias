import { createHash } from "node:crypto";
import {
  buildVatBoxValues,
  buildVatDraftLines,
  HmrcVatProvider,
  isUkComplianceVisible,
  roundCurrency,
  type VatReturnDraft,
} from "@tamias/compliance";
import {
  addYears,
  endOfQuarter,
  format,
  startOfQuarter,
  subYears,
} from "date-fns";
import type { Database } from "../../client";
import {
  countComplianceAdjustmentsByVatReturnIdFromConvex,
  countSourceLinksBySourceTypesFromConvex,
  createComplianceAdjustmentInConvex,
  createSubmissionEventInConvex,
  getComplianceAdjustmentsForPeriodFromConvex,
  getEvidencePackByIdFromConvex,
  getLatestVatReturnFromConvex,
  getVatObligationByIdFromConvex,
  getVatReturnByIdFromConvex,
  getVatReturnByObligationIdFromConvex,
  listVatObligationsFromConvex,
  listVatSubmissionsFromConvex,
  markVatReturnAcceptedInConvex,
  type ComplianceAdjustmentLineCode,
  type ComplianceObligationRecord,
  type CurrentUserIdentityRecord,
  type FilingProfileRecord,
  upsertEvidencePackInConvex,
  upsertVatObligationInConvex,
  upsertVatReturnInConvex,
} from "@tamias/app-data-convex";
import {
  assertUkComplianceEnabled,
  getFilingProfile,
  getHmrcProvider,
  getHmrcVatApp,
  getTeamContext,
} from "./shared";
import { listJournalRowsForPeriod, rebuildDerivedLedger } from "./ledger";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

type RecalculateVatDraftParams = {
  teamId: string;
  obligationId?: string;
  vatReturnId?: string;
};

type AddVatAdjustmentParams = {
  teamId: string;
  obligationId?: string;
  vatReturnId?: string;
  lineCode: ComplianceAdjustmentLineCode;
  amount: number;
  reason: string;
  note?: string | null;
  effectiveDate: string;
  createdBy: ConvexUserId;
};

type SubmitVatReturnParams = {
  teamId: string;
  vatReturnId: string;
  submittedBy: ConvexUserId;
  declarationAccepted: boolean;
  userAgent?: string;
  publicIp?: string;
};

type ListVatObligationsParams = {
  teamId: string;
};

type GetEvidencePackParams = {
  teamId: string;
  evidencePackId: string;
};

async function syncVatObligations(
  db: Database,
  params: ListVatObligationsParams & {
    team: Awaited<ReturnType<typeof getTeamContext>>;
    profile: FilingProfileRecord;
  },
) {
  if (!params.profile.vrn) {
    return [];
  }

  let providerData: Awaited<ReturnType<typeof getHmrcProvider>> | null = null;
  try {
    providerData = await getHmrcProvider(db, params.teamId, params.profile);
  } catch {
    return [];
  }

  if (!providerData) {
    return [];
  }

  const from = format(subYears(new Date(), 1), "yyyy-MM-dd");
  const to = format(addYears(new Date(), 1), "yyyy-MM-dd");
  let obligations: Awaited<
    ReturnType<typeof providerData.provider.getObligations>
  > = [];

  try {
    obligations = await providerData.provider.getObligations({
      vrn: params.profile.vrn,
      from,
      to,
      accessToken: providerData.config.accessToken,
    });
  } catch {
    return [];
  }

  for (const obligation of obligations) {
    await upsertVatObligationInConvex({
      teamId: params.teamId,
      filingProfileId: params.profile.id,
      provider: "hmrc-vat",
      obligationType: "vat",
      periodKey: obligation.periodKey,
      periodStart: obligation.start,
      periodEnd: obligation.end,
      dueDate: obligation.due,
      status: obligation.status,
      externalId: obligation.periodKey,
      raw: obligation,
    });
  }

  return obligations;
}

export async function listVatObligations(
  db: Database,
  params: ListVatObligationsParams,
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    return [];
  }

  assertUkComplianceEnabled(team, profile);

  await syncVatObligations(db, { ...params, team, profile });

  const obligations = await listVatObligationsFromConvex({
    teamId: params.teamId,
  });

  return obligations.filter(
    (item) => item.provider === "hmrc-vat" && item.obligationType === "vat",
  );
}

async function getDraftContext(
  db: Database,
  params: RecalculateVatDraftParams,
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

  let obligation: ComplianceObligationRecord | null = null;

  if (params.obligationId) {
    obligation = await getVatObligationByIdFromConvex({
      id: params.obligationId,
    });
  } else if (params.vatReturnId) {
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
    const obligations = await listVatObligations(db, { teamId: params.teamId });
    obligation =
      obligations.find((item) => item.status.toLowerCase() === "open") ??
      obligations[0] ??
      null;
  }

  if (!obligation) {
    const quarterStart = startOfQuarter(new Date());
    const quarterEnd = endOfQuarter(new Date());
    const periodKey = `${quarterStart.getFullYear()}-Q${Math.floor(quarterStart.getMonth() / 3) + 1}`;
    obligation = {
      id: `manual-${periodKey}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      teamId: params.teamId,
      filingProfileId: profile.id,
      provider: "hmrc-vat",
      obligationType: "vat",
      periodKey,
      periodStart: format(quarterStart, "yyyy-MM-dd"),
      periodEnd: format(quarterEnd, "yyyy-MM-dd"),
      dueDate: format(quarterEnd, "yyyy-MM-dd"),
      status: "open",
      externalId: null,
      raw: null,
    };
  }

  return { team, profile, obligation };
}

function buildAdjustmentMap(rows: Array<{ lineCode: string; amount: number }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lineCode] = roundCurrency((acc[row.lineCode] ?? 0) + row.amount);
    return acc;
  }, {});
}

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
  params: { teamId: string; obligationId?: string; vatReturnId?: string },
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

export async function recalculateVatDraft(
  db: Database,
  params: RecalculateVatDraftParams,
) {
  const context = await getDraftContext(db, params);

  const journalRows = listJournalRowsForPeriod(
    await rebuildDerivedLedger(db, {
      teamId: params.teamId,
      team: context.team,
      profile: context.profile,
    }),
    context.obligation.periodStart,
    context.obligation.periodEnd,
  );

  let outputVat = 0;
  let reclaimedVat = 0;
  let salesExVat = 0;
  let purchasesExVat = 0;

  for (const row of journalRows) {
    const amount = roundCurrency((row.credit ?? 0) - (row.debit ?? 0));

    const salesSourceAllowed =
      context.profile.accountingBasis === "cash"
        ? row.sourceType === "transaction"
        : row.sourceType === "invoice" || row.sourceType === "invoice_refund";

    if (row.accountCode === "2200" && salesSourceAllowed) {
      outputVat += amount;
    }

    if (row.accountCode === "1200" && row.sourceType === "transaction") {
      reclaimedVat += roundCurrency((row.debit ?? 0) - (row.credit ?? 0));
    }

    if (
      (row.accountCode === "4000" || row.accountCode === "4900") &&
      salesSourceAllowed
    ) {
      salesExVat += amount;
    }

    if (row.accountCode === "5000" && row.sourceType === "transaction") {
      purchasesExVat += roundCurrency((row.debit ?? 0) - (row.credit ?? 0));
    }
  }

  const adjustmentRows = await getComplianceAdjustmentsForPeriodFromConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    periodStart: context.obligation.periodStart,
    periodEnd: context.obligation.periodEnd,
  });

  const boxes = buildVatBoxValues({
    outputVat,
    reclaimedVat,
    salesExVat,
    purchasesExVat,
    adjustments: buildAdjustmentMap(adjustmentRows),
  });

  const draft = await upsertVatReturnInConvex({
    id: params.vatReturnId,
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    obligationId: context.obligation.id.startsWith("manual-")
      ? null
      : context.obligation.id,
    periodKey: context.obligation.periodKey,
    periodStart: context.obligation.periodStart,
    periodEnd: context.obligation.periodEnd,
    status: "ready",
    currency:
      context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    netVatDue: boxes.box5,
    lines: buildVatDraftLines(boxes).map(
      (line: VatReturnDraft["lines"][number]) => ({
        code: line.code,
        label: line.label,
        amount: line.amount,
      }),
    ),
  });

  if (!draft) {
    throw new Error("Failed to create VAT return draft");
  }

  await createSubmissionEventInConvex({
    teamId: params.teamId,
    filingProfileId: context.profile.id,
    provider: "hmrc-vat",
    obligationType: "vat",
    vatReturnId: draft.id,
    status: "ready",
    eventType: "draft_recalculated",
    requestPayload: {
      periodKey: context.obligation.periodKey,
      accountingBasis: context.profile.accountingBasis,
    },
    responsePayload: { boxes },
  });

  return readVatReturnDraft(db, draft.id);
}

export async function addVatAdjustment(
  db: Database,
  params: AddVatAdjustmentParams,
) {
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

async function buildEvidencePack(params: {
  teamId: string;
  filingProfileId: string;
  vatReturnId: string;
  createdBy: ConvexUserId;
  payload: Record<string, unknown>;
}) {
  const checksum = createHash("sha256")
    .update(JSON.stringify(params.payload))
    .digest("hex");

  return upsertEvidencePackInConvex({
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
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);

  if (!profile) {
    throw new Error("Filing profile not configured");
  }

  assertUkComplianceEnabled(team, profile);

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
      receipt.formBundleNumber ??
      receipt.chargeRefNumber ??
      receipt.processingDate ??
      null,
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

export async function listVatSubmissions(
  db: Database,
  params: { teamId: string },
) {
  void db;
  return listVatSubmissionsFromConvex({
    teamId: params.teamId,
  });
}

export async function getEvidencePack(params: GetEvidencePackParams) {
  return getEvidencePackByIdFromConvex({
    teamId: params.teamId,
    id: params.evidencePackId,
  });
}

export async function getVatDashboard(
  db: Database,
  params: { teamId: string },
) {
  const team = await getTeamContext(db, params.teamId);
  const profile = await getFilingProfile(db, params.teamId);
  const app = await getHmrcVatApp(db, params.teamId);
  const obligations = profile
    ? await listVatObligations(db, { teamId: params.teamId })
    : [];
  const latestDraft = await getVatDraft(db, { teamId: params.teamId });
  const submissions = await listVatSubmissions(db, params);
  const latestSubmission =
    submissions.find((submission) => submission.submittedAt) ?? null;

  return {
    enabled: isUkComplianceVisible({
      countryCode: team.countryCode,
      profileEnabled: profile?.enabled,
    }),
    team,
    profile,
    connected: Boolean(app?.config),
    obligations,
    latestDraft,
    latestSubmission,
  };
}
