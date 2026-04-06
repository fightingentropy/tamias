import { generateToken } from "@tamias/invoice/token";
import type { EditorDoc, LineItem } from "@tamias/invoice/types";
import type { DatabaseOrTransaction } from "../../../client";
import type { Template } from "../../invoice-projections";
import { getInvoiceById } from "../reads";
import { type DraftInvoiceParams, hasOwnKey, upsertProjectedInvoiceRecord } from "../shared";

export async function draftInvoice(db: DatabaseOrTransaction, params: DraftInvoiceParams) {
  const { id, teamId, userId, token, template } = params;

  const useToken = token ?? (await generateToken(id));
  const existing = await getInvoiceById(db, { id, teamId });
  const timestamp = new Date().toISOString();
  const { paymentDetails: _ignoredPayment, fromDetails: _ignoredFrom, ...restTemplate } = template;
  const nextCustomerId = hasOwnKey(params, "customerId")
    ? (params.customerId ?? null)
    : (existing?.customerId ?? null);
  const nextCustomerName = hasOwnKey(params, "customerName")
    ? (params.customerName ?? null)
    : hasOwnKey(params, "customerId")
      ? null
      : (existing?.customerName ?? null);
  const status =
    existing?.status === "overdue" && new Date(params.dueDate).getTime() >= Date.now()
      ? "unpaid"
      : (existing?.status ?? "draft");

  return upsertProjectedInvoiceRecord(
    db,
    {
      id,
      dueDate: params.dueDate,
      invoiceNumber: params.invoiceNumber,
      createdAt: existing?.createdAt ?? timestamp,
      amount: hasOwnKey(params, "amount") ? (params.amount ?? null) : (existing?.amount ?? null),
      currency: template.currency?.toUpperCase() ?? existing?.currency ?? null,
      lineItems: hasOwnKey(params, "lineItems")
        ? ((params.lineItems ?? []) as LineItem[])
        : (existing?.lineItems ?? []),
      paymentDetails: hasOwnKey(params, "paymentDetails")
        ? ((params.paymentDetails ?? null) as EditorDoc | null)
        : (existing?.paymentDetails ?? null),
      customerDetails: hasOwnKey(params, "customerDetails")
        ? ((params.customerDetails ?? null) as EditorDoc | null)
        : (existing?.customerDetails ?? null),
      reminderSentAt: existing?.reminderSentAt ?? null,
      updatedAt: timestamp,
      note: existing?.note ?? null,
      internalNote: existing?.internalNote ?? null,
      paidAt: existing?.paidAt ?? null,
      vat: hasOwnKey(params, "vat") ? (params.vat ?? null) : (existing?.vat ?? null),
      tax: hasOwnKey(params, "tax") ? (params.tax ?? null) : (existing?.tax ?? null),
      filePath: existing?.filePath ?? null,
      status,
      fileSize: existing?.fileSize ?? null,
      viewedAt: existing?.viewedAt ?? null,
      fromDetails: hasOwnKey(params, "fromDetails")
        ? ((params.fromDetails ?? null) as EditorDoc | null)
        : (existing?.fromDetails ?? null),
      issueDate: params.issueDate,
      sentAt: existing?.sentAt ?? null,
      template: restTemplate as Template,
      templateId: hasOwnKey(params, "templateId")
        ? (params.templateId ?? null)
        : (existing?.templateId ?? null),
      noteDetails: hasOwnKey(params, "noteDetails")
        ? ((params.noteDetails ?? null) as EditorDoc | null)
        : (existing?.noteDetails ?? null),
      customerName: nextCustomerName,
      token: useToken,
      sentTo: existing?.sentTo ?? null,
      discount: hasOwnKey(params, "discount")
        ? (params.discount ?? null)
        : (existing?.discount ?? null),
      subtotal: hasOwnKey(params, "subtotal")
        ? (params.subtotal ?? null)
        : (existing?.subtotal ?? null),
      topBlock: hasOwnKey(params, "topBlock")
        ? ((params.topBlock ?? null) as EditorDoc | null)
        : (existing?.topBlock ?? null),
      bottomBlock: hasOwnKey(params, "bottomBlock")
        ? ((params.bottomBlock ?? null) as EditorDoc | null)
        : (existing?.bottomBlock ?? null),
      scheduledAt: existing?.scheduledAt ?? null,
      scheduledJobId: existing?.scheduledJobId ?? null,
      paymentIntentId: existing?.paymentIntentId ?? null,
      refundedAt: existing?.refundedAt ?? null,
      teamId,
      customerId: nextCustomerId,
      invoiceRecurringId: existing?.invoiceRecurringId ?? null,
      recurringSequence: existing?.recurringSequence ?? null,
    },
    {
      existing,
      userId,
    },
  );
}
