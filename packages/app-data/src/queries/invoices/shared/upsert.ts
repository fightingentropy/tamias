import {
  getCustomerByIdFromConvex,
  getInvoiceRecurringSeriesByLegacyIdFromConvex,
  upsertPublicInvoiceInConvex,
} from "../../../convex";
import type { Database, DatabaseOrTransaction } from "../../../client";
import { getInvoiceTemplateById } from "../../invoice-templates";
import { getTeamById } from "../../teams";
import { getUserByConvexId } from "../../users";
import type {
  InvoiceByIdResult,
  InvoiceConvexUserId,
  InvoiceProjectionInput,
  InvoiceRecurringFrequency,
} from "./types";

function getEmptyRecurringSummary(): InvoiceByIdResult["recurring"] {
  return {
    id: null,
    frequency: "monthly_date",
    frequencyInterval: 1,
    status: null,
    nextScheduledAt: null,
    endType: null,
    endCount: 0,
    invoicesGenerated: 0,
  };
}

async function getInvoiceRecurringSummary(
  invoiceRecurringId: string | null | undefined,
): Promise<InvoiceByIdResult["recurring"]> {
  if (!invoiceRecurringId) {
    return getEmptyRecurringSummary();
  }

  const projectedRecurring =
    await getInvoiceRecurringSeriesByLegacyIdFromConvex({
      id: invoiceRecurringId,
    });
  const recurring = projectedRecurring?.payload as
    | Partial<InvoiceByIdResult["recurring"]>
    | undefined
    | null;

  if (!recurring || typeof recurring !== "object") {
    return {
      ...getEmptyRecurringSummary(),
      id: invoiceRecurringId,
    };
  }

  return {
    id: invoiceRecurringId,
    frequency:
      (recurring.frequency as InvoiceRecurringFrequency | undefined) ??
      "monthly_date",
    frequencyInterval:
      typeof recurring.frequencyInterval === "number"
        ? recurring.frequencyInterval
        : 1,
    status: typeof recurring.status === "string" ? recurring.status : null,
    nextScheduledAt:
      typeof recurring.nextScheduledAt === "string"
        ? recurring.nextScheduledAt
        : null,
    endType: typeof recurring.endType === "string" ? recurring.endType : null,
    endCount: typeof recurring.endCount === "number" ? recurring.endCount : 0,
    invoicesGenerated:
      typeof recurring.invoicesGenerated === "number"
        ? recurring.invoicesGenerated
        : 0,
  };
}

async function hydrateInvoiceRecord(
  db: DatabaseOrTransaction,
  record: InvoiceProjectionInput,
  options?: {
    existing?: InvoiceByIdResult | null;
    userId?: InvoiceConvexUserId | null;
  },
): Promise<InvoiceByIdResult> {
  const existing = options?.existing ?? null;
  const [team, user, customer, recurring, invoiceTemplate] = await Promise.all([
    getTeamById(db as Database, record.teamId),
    options?.userId ? getUserByConvexId(db as Database, options.userId) : null,
    record.customerId
      ? getCustomerByIdFromConvex({
          teamId: record.teamId,
          customerId: record.customerId,
        })
      : null,
    getInvoiceRecurringSummary(record.invoiceRecurringId),
    record.templateId
      ? getInvoiceTemplateById({
          id: record.templateId,
          teamId: record.teamId,
        })
      : null,
  ]);

  const template = { ...record.template };

  if (invoiceTemplate?.id) {
    template.id = invoiceTemplate.id;
    template.name = invoiceTemplate.name ?? "Default";
    template.isDefault = invoiceTemplate.isDefault ?? false;
  } else if (record.templateId) {
    template.id = record.templateId;
  }

  return {
    ...record,
    customerName: record.customerName ?? customer?.name ?? null,
    customer: {
      id: customer?.id ?? null,
      name: customer?.name ?? null,
      website: customer?.website ?? null,
      email: customer?.email ?? null,
      billingEmail: customer?.billingEmail ?? null,
      portalId: customer?.portalId ?? null,
      portalEnabled: customer?.portalEnabled ?? null,
    },
    user: user
      ? {
          email: user.email ?? null,
          timezone: user.timezone ?? null,
          locale: user.locale ?? null,
        }
      : (existing?.user ?? {
          email: null,
          timezone: null,
          locale: null,
        }),
    team: {
      name: team?.name ?? null,
      email: team?.email ?? null,
      stripeConnected:
        !!team?.stripeAccountId && team.stripeConnectStatus === "connected",
    },
    recurring,
    template,
  };
}

export async function upsertProjectedInvoiceRecord(
  db: DatabaseOrTransaction,
  record: InvoiceProjectionInput,
  options?: {
    existing?: InvoiceByIdResult | null;
    userId?: InvoiceConvexUserId | null;
  },
) {
  const hydrated = await hydrateInvoiceRecord(db, record, options);

  await upsertPublicInvoiceInConvex({
    teamId: hydrated.teamId,
    id: hydrated.id,
    token: hydrated.token,
    status: hydrated.status,
    paymentIntentId: hydrated.paymentIntentId,
    viewedAt: hydrated.viewedAt,
    invoiceNumber: hydrated.invoiceNumber,
    payload: JSON.parse(JSON.stringify(hydrated)) as Record<string, unknown>,
  });

  return hydrated;
}
