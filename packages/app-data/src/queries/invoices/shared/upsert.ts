import type { Database, DatabaseOrTransaction } from "../../../client";
import { syncPublicInvoiceComplianceJournalEntry } from "../../compliance/ledger";
import { getCustomerByIdFromD1, requireCustomersD1 } from "../../customers/d1";
import { getProjectedInvoiceRecurringById } from "../../invoice-recurring/shared";
import { getInvoiceTemplateById } from "../../invoice-templates";
import { upsertPublicInvoice } from "../../public-invoices";
import { getTeamById } from "../../teams";
import { getUserById } from "../../users";
import type {
  InvoiceByIdResult,
  InvoiceUserId,
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
  db: DatabaseOrTransaction,
  teamId: string,
  invoiceRecurringId: string | null | undefined,
): Promise<InvoiceByIdResult["recurring"]> {
  if (!invoiceRecurringId) {
    return getEmptyRecurringSummary();
  }

  const recurring = await getProjectedInvoiceRecurringById(db as Database, {
    id: invoiceRecurringId,
    teamId,
  });

  if (!recurring) {
    return {
      ...getEmptyRecurringSummary(),
      id: invoiceRecurringId,
    };
  }

  return {
    id: invoiceRecurringId,
    frequency: (recurring.frequency as InvoiceRecurringFrequency | undefined) ?? "monthly_date",
    frequencyInterval: recurring.frequencyInterval ?? 1,
    status: recurring.status,
    nextScheduledAt: recurring.nextScheduledAt,
    endType: recurring.endType,
    endCount: recurring.endCount ?? 0,
    invoicesGenerated: recurring.invoicesGenerated,
  };
}

async function hydrateInvoiceRecord(
  db: DatabaseOrTransaction,
  record: InvoiceProjectionInput,
  options?: {
    existing?: InvoiceByIdResult | null;
    userId?: InvoiceUserId | null;
  },
): Promise<InvoiceByIdResult> {
  const existing = options?.existing ?? null;
  const [team, user, customer, recurring, invoiceTemplate] = await Promise.all([
    getTeamById(db as Database, record.teamId),
    options?.userId ? getUserById(db as Database, options.userId) : null,
    record.customerId
      ? getCustomerByIdFromD1(requireCustomersD1(db as Database), {
          teamId: record.teamId,
          id: record.customerId,
        })
      : null,
    getInvoiceRecurringSummary(db, record.teamId, record.invoiceRecurringId),
    record.templateId
      ? getInvoiceTemplateById(db as Database, {
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
      stripeConnected: !!team?.stripeAccountId && team.stripeConnectStatus === "connected",
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
    userId?: InvoiceUserId | null;
  },
) {
  const hydrated = await hydrateInvoiceRecord(db, record, options);

  await upsertPublicInvoice(db, {
    teamId: hydrated.teamId,
    id: hydrated.id,
    token: hydrated.token,
    status: hydrated.status,
    paymentIntentId: hydrated.paymentIntentId,
    viewedAt: hydrated.viewedAt,
    invoiceNumber: hydrated.invoiceNumber,
    payload: JSON.parse(JSON.stringify(hydrated)) as Record<string, unknown>,
  });
  await syncPublicInvoiceComplianceJournalEntry(db as Database, {
    teamId: hydrated.teamId,
    previous: options?.existing ?? null,
    next: hydrated,
  });

  return hydrated;
}
