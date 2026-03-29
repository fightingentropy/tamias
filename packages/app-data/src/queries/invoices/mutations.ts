import { generateToken } from "@tamias/invoice/token";
import type { EditorDoc, LineItem } from "@tamias/invoice/types";
import { addMonths } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import { deletePublicInvoiceInConvex } from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import {
  logActivity,
  type InvoiceActivityType,
} from "../../utils/log-activity";
import type { Template } from "../invoice-projections";
import { getInvoiceById } from "./reads";
import {
  type DraftInvoiceParams,
  type DraftInvoiceTemplateParams,
  type InvoiceConvexUserId,
  hasOwnKey,
  upsertProjectedInvoiceRecord,
} from "./shared";

export async function draftInvoice(
  db: DatabaseOrTransaction,
  params: DraftInvoiceParams,
) {
  const { id, teamId, userId, token, template } = params;

  const useToken = token ?? (await generateToken(id));
  const existing = await getInvoiceById(db, { id, teamId });
  const timestamp = new Date().toISOString();
  const {
    paymentDetails: _ignoredPayment,
    fromDetails: _ignoredFrom,
    ...restTemplate
  } = template;
  const nextCustomerId = hasOwnKey(params, "customerId")
    ? (params.customerId ?? null)
    : (existing?.customerId ?? null);
  const nextCustomerName = hasOwnKey(params, "customerName")
    ? (params.customerName ?? null)
    : hasOwnKey(params, "customerId")
      ? null
      : (existing?.customerName ?? null);
  const status =
    existing?.status === "overdue" &&
    new Date(params.dueDate).getTime() >= Date.now()
      ? "unpaid"
      : (existing?.status ?? "draft");

  return upsertProjectedInvoiceRecord(
    db,
    {
      id,
      dueDate: params.dueDate,
      invoiceNumber: params.invoiceNumber,
      createdAt: existing?.createdAt ?? timestamp,
      amount: hasOwnKey(params, "amount")
        ? (params.amount ?? null)
        : (existing?.amount ?? null),
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
      vat: hasOwnKey(params, "vat")
        ? (params.vat ?? null)
        : (existing?.vat ?? null),
      tax: hasOwnKey(params, "tax")
        ? (params.tax ?? null)
        : (existing?.tax ?? null),
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

export type DeleteInvoiceParams = {
  id: string;
  teamId: string;
};

export async function deleteInvoice(db: Database, params: DeleteInvoiceParams) {
  const { id, teamId } = params;
  const existing = await getInvoiceById(db, { id, teamId });

  if (!existing || !["draft", "canceled"].includes(existing.status)) {
    return null;
  }

  await deletePublicInvoiceInConvex({
    teamId,
    id,
  });

  return { id };
}

export type DuplicateInvoiceParams = {
  id: string;
  userId: InvoiceConvexUserId;
  invoiceNumber: string;
  teamId: string;
};

export async function duplicateInvoice(
  db: Database,
  params: DuplicateInvoiceParams,
) {
  const { id, userId, invoiceNumber, teamId } = params;
  const invoice = await getInvoiceById(db, {
    id,
    teamId,
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const draftId = uuidv4();
  const token = await generateToken(draftId);

  const result = await draftInvoice(db, {
    id: draftId,
    token,
    userId,
    teamId: invoice.teamId,
    template: invoice.template as DraftInvoiceTemplateParams,
    dueDate: addMonths(new Date(), 1).toISOString(),
    issueDate: new Date().toISOString(),
    invoiceNumber,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    vat: invoice.vat,
    tax: invoice.tax,
    discount: invoice.discount,
    subtotal: invoice.subtotal,
    amount: invoice.amount,
    // @ts-expect-error - JSONB
    paymentDetails: invoice.paymentDetails,
    // @ts-expect-error - JSONB
    noteDetails: invoice.noteDetails,
    // @ts-expect-error - JSONB
    topBlock: invoice.topBlock,
    // @ts-expect-error - JSONB
    bottomBlock: invoice.bottomBlock,
    // @ts-expect-error - JSONB
    fromDetails: invoice.fromDetails,
    // @ts-expect-error - JSONB
    customerDetails: invoice.customerDetails,
    lineItems: invoice.lineItems,
  });

  logActivity({
    db,
    teamId,
    userId,
    type: "invoice_duplicated",
    metadata: {
      originalInvoiceId: id,
      newInvoiceId: result?.id,
      newInvoiceNumber: result?.invoiceNumber,
    },
  });

  return result;
}

export type UpdateInvoiceParams = {
  id: string;
  status?:
    | "paid"
    | "canceled"
    | "unpaid"
    | "overdue"
    | "scheduled"
    | "draft"
    | "refunded";
  paidAt?: string | null;
  internalNote?: string | null;
  reminderSentAt?: string | null;
  scheduledAt?: string | null;
  scheduledJobId?: string | null;
  paymentIntentId?: string | null;
  refundedAt?: string | null;
  sentTo?: string | null;
  sentAt?: string | null;
  filePath?: string[] | null;
  fileSize?: number | null;
  invoiceRecurringId?: string | null;
  recurringSequence?: number | null;
  teamId: string;
  userId?: InvoiceConvexUserId;
};

export async function updateInvoice(
  db: DatabaseOrTransaction,
  params: UpdateInvoiceParams,
) {
  const { id, teamId, userId, ...rest } = params;
  const existing = await getInvoiceById(db, { id, teamId });

  if (!existing) {
    return null;
  }

  const timestamp = new Date().toISOString();
  const result = await upsertProjectedInvoiceRecord(
    db,
    {
      ...existing,
      updatedAt: timestamp,
      status: hasOwnKey(rest, "status")
        ? (rest.status ?? existing.status)
        : existing.status,
      paidAt: hasOwnKey(rest, "paidAt")
        ? (rest.paidAt ?? null)
        : existing.paidAt,
      internalNote: hasOwnKey(rest, "internalNote")
        ? (rest.internalNote ?? null)
        : existing.internalNote,
      reminderSentAt: hasOwnKey(rest, "reminderSentAt")
        ? (rest.reminderSentAt ?? null)
        : existing.reminderSentAt,
      scheduledAt: hasOwnKey(rest, "scheduledAt")
        ? (rest.scheduledAt ?? null)
        : existing.scheduledAt,
      scheduledJobId: hasOwnKey(rest, "scheduledJobId")
        ? (rest.scheduledJobId ?? null)
        : existing.scheduledJobId,
      paymentIntentId: hasOwnKey(rest, "paymentIntentId")
        ? (rest.paymentIntentId ?? null)
        : existing.paymentIntentId,
      refundedAt: hasOwnKey(rest, "refundedAt")
        ? (rest.refundedAt ?? null)
        : existing.refundedAt,
      sentTo: hasOwnKey(rest, "sentTo")
        ? (rest.sentTo ?? null)
        : existing.sentTo,
      sentAt: hasOwnKey(rest, "sentAt")
        ? (rest.sentAt ?? null)
        : existing.sentAt,
      filePath: hasOwnKey(rest, "filePath")
        ? (rest.filePath ?? null)
        : existing.filePath,
      fileSize: hasOwnKey(rest, "fileSize")
        ? (rest.fileSize ?? null)
        : existing.fileSize,
      invoiceRecurringId: hasOwnKey(rest, "invoiceRecurringId")
        ? (rest.invoiceRecurringId ?? null)
        : existing.invoiceRecurringId,
      recurringSequence: hasOwnKey(rest, "recurringSequence")
        ? (rest.recurringSequence ?? null)
        : existing.recurringSequence,
    },
    {
      existing,
    },
  );

  if (rest.status !== "draft" && userId) {
    let priority: number | undefined;
    let activityType: InvoiceActivityType | null = null;

    if (rest.status === "paid") {
      activityType = "invoice_paid";
      priority = 3;
    } else if (rest.status === "canceled") {
      activityType = "invoice_cancelled";
      priority = 3;
    }

    if (activityType) {
      logActivity({
        db,
        teamId,
        userId,
        type: activityType,
        priority,
        metadata: {
          recordId: id,
          invoiceNumber: result.invoiceNumber,
          customerName: result.customerName,
          newStatus: rest.status,
          paidAt: rest.paidAt,
        },
      });
    }
  }

  return result;
}

export async function markInvoiceViewed(
  db: DatabaseOrTransaction,
  params: { id: string },
) {
  const existing = await getInvoiceById(db, { id: params.id });

  if (!existing) {
    return null;
  }

  const viewedAt = new Date().toISOString();

  await upsertProjectedInvoiceRecord(
    db,
    {
      ...existing,
      viewedAt,
      updatedAt: viewedAt,
    },
    {
      existing,
    },
  );

  return {
    id: existing.id,
    viewedAt,
  };
}
