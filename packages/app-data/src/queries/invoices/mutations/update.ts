import type { DatabaseOrTransaction } from "../../../client";
import { logActivity, type InvoiceActivityType } from "../../../utils/log-activity";
import { getInvoiceById } from "../reads";
import { type InvoiceConvexUserId, hasOwnKey, upsertProjectedInvoiceRecord } from "../shared";

export type UpdateInvoiceParams = {
  id: string;
  status?: "paid" | "canceled" | "unpaid" | "overdue" | "scheduled" | "draft" | "refunded";
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

export async function updateInvoice(db: DatabaseOrTransaction, params: UpdateInvoiceParams) {
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
      status: hasOwnKey(rest, "status") ? (rest.status ?? existing.status) : existing.status,
      paidAt: hasOwnKey(rest, "paidAt") ? (rest.paidAt ?? null) : existing.paidAt,
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
      refundedAt: hasOwnKey(rest, "refundedAt") ? (rest.refundedAt ?? null) : existing.refundedAt,
      sentTo: hasOwnKey(rest, "sentTo") ? (rest.sentTo ?? null) : existing.sentTo,
      sentAt: hasOwnKey(rest, "sentAt") ? (rest.sentAt ?? null) : existing.sentAt,
      filePath: hasOwnKey(rest, "filePath") ? (rest.filePath ?? null) : existing.filePath,
      fileSize: hasOwnKey(rest, "fileSize") ? (rest.fileSize ?? null) : existing.fileSize,
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
