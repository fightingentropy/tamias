import {
  buildVatBoxValues,
  buildVatDraftLines,
  roundCurrency,
  type VatReturnDraft,
} from "@tamias/compliance";
import {
  createSubmissionEventInConvex,
  getComplianceAdjustmentsForPeriodFromConvex,
  upsertVatReturnInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../../client";
import { listDerivedLedgerEntries, listJournalRowsForPeriod } from "../../ledger";
import type { RecalculateVatDraftParams } from "../types";
import { getDraftContext } from "./context";
import { getVatDraft } from "./reader";

function buildAdjustmentMap(rows: Array<{ lineCode: string; amount: number }>) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lineCode] = roundCurrency((acc[row.lineCode] ?? 0) + row.amount);
    return acc;
  }, {});
}

export async function recalculateVatDraft(db: Database, params: RecalculateVatDraftParams) {
  const context = await getDraftContext(db, params);
  const journalRows = listJournalRowsForPeriod(
    await listDerivedLedgerEntries(db, {
      teamId: params.teamId,
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

    if ((row.accountCode === "4000" || row.accountCode === "4900") && salesSourceAllowed) {
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
    obligationId: context.obligation.id.startsWith("manual-") ? null : context.obligation.id,
    periodKey: context.obligation.periodKey,
    periodStart: context.obligation.periodStart,
    periodEnd: context.obligation.periodEnd,
    status: "ready",
    currency: context.profile.baseCurrency ?? context.team.baseCurrency ?? "GBP",
    netVatDue: boxes.box5,
    lines: buildVatDraftLines(boxes).map((line: VatReturnDraft["lines"][number]) => ({
      code: line.code,
      label: line.label,
      amount: line.amount,
    })),
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

  return getVatDraft(db, { teamId: params.teamId, vatReturnId: draft.id });
}
