import { calculateFirstScheduledDate } from "@tamias/invoice/server-recurring";
import type { DatabaseOrTransaction } from "../../../client";
import { upsertProjectedInvoiceRecurringRecord } from "../shared";
import type { CreateInvoiceRecurringParams } from "../shared";

export async function createInvoiceRecurring(
  _db: DatabaseOrTransaction,
  params: CreateInvoiceRecurringParams,
) {
  const now = new Date();
  const issueDateParsed = params.issueDate ? new Date(params.issueDate) : now;
  const firstScheduledAt = calculateFirstScheduledDate(
    {
      frequency: params.frequency,
      frequencyDay: params.frequencyDay ?? null,
      frequencyWeek: params.frequencyWeek ?? null,
      frequencyInterval: params.frequencyInterval ?? null,
      timezone: params.timezone,
    },
    issueDateParsed,
    now,
  );
  const timestamp = now.toISOString();

  return upsertProjectedInvoiceRecurringRecord({
    id: crypto.randomUUID(),
    createdAt: timestamp,
    updatedAt: timestamp,
    teamId: params.teamId,
    userId: params.userId,
    customerId: params.customerId ?? null,
    frequency: params.frequency,
    frequencyDay: params.frequencyDay ?? null,
    frequencyWeek: params.frequencyWeek ?? null,
    frequencyInterval: params.frequencyInterval ?? null,
    endType: params.endType,
    endDate: params.endDate ?? null,
    endCount: params.endCount ?? null,
    status: "active",
    invoicesGenerated: 0,
    consecutiveFailures: 0,
    nextScheduledAt: firstScheduledAt.toISOString(),
    lastGeneratedAt: null,
    upcomingNotificationSentAt: null,
    timezone: params.timezone,
    dueDateOffset: params.dueDateOffset ?? 30,
    amount: params.amount ?? null,
    currency: params.currency ?? null,
    lineItems: params.lineItems ?? null,
    template: params.template ?? null,
    paymentDetails: params.paymentDetails ?? null,
    fromDetails: params.fromDetails ?? null,
    noteDetails: params.noteDetails ?? null,
    customerName: params.customerName ?? null,
    vat: params.vat ?? null,
    tax: params.tax ?? null,
    discount: params.discount ?? null,
    subtotal: params.subtotal ?? null,
    topBlock: params.topBlock ?? null,
    bottomBlock: params.bottomBlock ?? null,
    templateId: params.templateId ?? null,
  });
}
