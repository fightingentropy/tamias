import {
  calculateNextScheduledDate,
} from "@tamias/invoice/server-recurring";
import type { DatabaseOrTransaction } from "../../../client";
import { getInvoiceRecurringById } from "../reads";
import {
  buildRecurringParams,
  hasOwnKey,
  upsertProjectedInvoiceRecurringRecord,
  type ProjectedInvoiceRecurringRecord,
  type UpdateInvoiceRecurringParams,
} from "../shared";
import { mergeNextCustomer } from "./shared";

export async function updateInvoiceRecurring(
  db: DatabaseOrTransaction,
  params: UpdateInvoiceRecurringParams,
) {
  const {
    id,
    teamId,
    nextScheduledAt: explicitNextScheduledAt,
    lastGeneratedAt: explicitLastGeneratedAt,
    ...updateData
  } = params;

  const frequencyFieldsChanged =
    params.frequency !== undefined ||
    params.frequencyDay !== undefined ||
    params.frequencyWeek !== undefined ||
    params.frequencyInterval !== undefined;
  const endConditionsChanged =
    params.endType !== undefined ||
    params.endDate !== undefined ||
    params.endCount !== undefined;

  let nextScheduledAt: string | undefined = explicitNextScheduledAt;
  let current: ProjectedInvoiceRecurringRecord | null = null;

  if (frequencyFieldsChanged || endConditionsChanged) {
    current = await getInvoiceRecurringById(db as DatabaseOrTransaction, {
      id,
      teamId,
    });
  }

  if (current && endConditionsChanged) {
    const mergedEndType = params.endType ?? current.endType;
    const mergedEndDate =
      params.endDate !== undefined ? params.endDate : current.endDate;
    const mergedEndCount =
      params.endCount !== undefined ? params.endCount : current.endCount;

    if (mergedEndType === "on_date" && !mergedEndDate) {
      throw new Error("endDate is required when endType is 'on_date'");
    }

    if (mergedEndType === "after_count" && !mergedEndCount) {
      throw new Error("endCount is required when endType is 'after_count'");
    }
  }

  if (!nextScheduledAt && frequencyFieldsChanged && current?.status === "active") {
    nextScheduledAt = calculateNextScheduledDate(
      {
        frequency: params.frequency ?? current.frequency,
        frequencyDay:
          params.frequencyDay !== undefined
            ? params.frequencyDay
            : current.frequencyDay,
        frequencyWeek:
          params.frequencyWeek !== undefined
            ? params.frequencyWeek
            : current.frequencyWeek,
        frequencyInterval:
          params.frequencyInterval !== undefined
            ? params.frequencyInterval
            : current.frequencyInterval,
        timezone: params.timezone ?? current.timezone,
      },
      new Date(),
    ).toISOString();
  }

  const existing =
    current ?? (await getInvoiceRecurringById(db as DatabaseOrTransaction, { id, teamId }));

  if (!existing) {
    return null;
  }

  const { nextCustomerId, nextCustomerName } = mergeNextCustomer(existing, params);

  return upsertProjectedInvoiceRecurringRecord({
    ...existing,
    updatedAt: new Date().toISOString(),
    customerId: nextCustomerId,
    customerName: nextCustomerName,
    frequency: hasOwnKey(updateData, "frequency")
      ? (updateData.frequency ?? existing.frequency)
      : existing.frequency,
    frequencyDay: hasOwnKey(updateData, "frequencyDay")
      ? (updateData.frequencyDay ?? null)
      : existing.frequencyDay,
    frequencyWeek: hasOwnKey(updateData, "frequencyWeek")
      ? (updateData.frequencyWeek ?? null)
      : existing.frequencyWeek,
    frequencyInterval: hasOwnKey(updateData, "frequencyInterval")
      ? (updateData.frequencyInterval ?? null)
      : existing.frequencyInterval,
    endType: hasOwnKey(updateData, "endType")
      ? (updateData.endType ?? existing.endType)
      : existing.endType,
    endDate: hasOwnKey(updateData, "endDate")
      ? (updateData.endDate ?? null)
      : existing.endDate,
    endCount: hasOwnKey(updateData, "endCount")
      ? (updateData.endCount ?? null)
      : existing.endCount,
    timezone: hasOwnKey(updateData, "timezone")
      ? (updateData.timezone ?? existing.timezone)
      : existing.timezone,
    dueDateOffset: hasOwnKey(updateData, "dueDateOffset")
      ? (updateData.dueDateOffset ?? existing.dueDateOffset)
      : existing.dueDateOffset,
    amount: hasOwnKey(updateData, "amount")
      ? (updateData.amount ?? null)
      : existing.amount,
    currency: hasOwnKey(updateData, "currency")
      ? (updateData.currency ?? null)
      : existing.currency,
    lineItems: hasOwnKey(updateData, "lineItems")
      ? (updateData.lineItems ?? null)
      : existing.lineItems,
    template: hasOwnKey(updateData, "template")
      ? (updateData.template ?? null)
      : existing.template,
    paymentDetails: hasOwnKey(updateData, "paymentDetails")
      ? (updateData.paymentDetails ?? null)
      : existing.paymentDetails,
    fromDetails: hasOwnKey(updateData, "fromDetails")
      ? (updateData.fromDetails ?? null)
      : existing.fromDetails,
    noteDetails: hasOwnKey(updateData, "noteDetails")
      ? (updateData.noteDetails ?? null)
      : existing.noteDetails,
    vat: hasOwnKey(updateData, "vat") ? (updateData.vat ?? null) : existing.vat,
    tax: hasOwnKey(updateData, "tax") ? (updateData.tax ?? null) : existing.tax,
    discount: hasOwnKey(updateData, "discount")
      ? (updateData.discount ?? null)
      : existing.discount,
    subtotal: hasOwnKey(updateData, "subtotal")
      ? (updateData.subtotal ?? null)
      : existing.subtotal,
    topBlock: hasOwnKey(updateData, "topBlock")
      ? (updateData.topBlock ?? null)
      : existing.topBlock,
    bottomBlock: hasOwnKey(updateData, "bottomBlock")
      ? (updateData.bottomBlock ?? null)
      : existing.bottomBlock,
    templateId: hasOwnKey(updateData, "templateId")
      ? (updateData.templateId ?? null)
      : existing.templateId,
    status: hasOwnKey(updateData, "status")
      ? (updateData.status ?? existing.status)
      : existing.status,
    invoicesGenerated: hasOwnKey(updateData, "invoicesGenerated")
      ? (updateData.invoicesGenerated ?? existing.invoicesGenerated)
      : existing.invoicesGenerated,
    nextScheduledAt:
      nextScheduledAt ??
      (hasOwnKey(params, "nextScheduledAt")
        ? (params.nextScheduledAt ?? null)
        : existing.nextScheduledAt),
    lastGeneratedAt: explicitLastGeneratedAt ?? existing.lastGeneratedAt,
  });
}
