import {
  getPublicInvoiceByPaymentIntentIdFromConvex,
  getPublicInvoiceByRecurringSequenceFromConvex,
  getPublicInvoicesByFiltersFromConvex,
  getPublicInvoicesByRecurringIdFromConvex,
  getPublicInvoicesByTeamFromConvex,
  type PublicInvoiceFilterDateField,
} from "../convex";
import type { EditorDoc, LineItem } from "@tamias/invoice/types";

export type InvoiceStatus =
  | "draft"
  | "overdue"
  | "paid"
  | "unpaid"
  | "canceled"
  | "scheduled"
  | "refunded";

export type Template = {
  id?: string;
  name?: string;
  isDefault?: boolean;
  customerLabel: string;
  title: string;
  fromLabel: string;
  invoiceNoLabel: string;
  issueDateLabel: string;
  dueDateLabel: string;
  descriptionLabel: string;
  priceLabel: string;
  quantityLabel: string;
  totalLabel: string;
  totalSummaryLabel: string;
  vatLabel: string;
  subtotalLabel: string;
  taxLabel: string;
  discountLabel: string;
  timezone: string;
  paymentLabel: string;
  noteLabel: string;
  logoUrl: string | null;
  currency: string;
  paymentDetails: EditorDoc | null;
  fromDetails: EditorDoc | null;
  noteDetails: EditorDoc | null;
  dateFormat: string;
  includeVat: boolean;
  includeTax: boolean;
  includeDiscount: boolean;
  includeDecimals: boolean;
  includeUnits: boolean;
  includeQr: boolean;
  taxRate: number;
  vatRate: number;
  size: "a4" | "letter";
  deliveryType: "create" | "create_and_send" | "scheduled";
  locale: string;
  paymentEnabled?: boolean;
  paymentTermsDays?: number;
};

type InvoiceRecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly_date"
  | "monthly_weekday"
  | "monthly_last_day"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "custom";

export type ProjectedInvoiceRecord = {
  id: string;
  dueDate: string | null;
  invoiceNumber: string;
  createdAt: string;
  amount: number | null;
  currency: string | null;
  lineItems: LineItem[];
  paymentDetails: EditorDoc | null;
  customerDetails: EditorDoc | null;
  reminderSentAt: string | null;
  updatedAt: string;
  note: string | null;
  internalNote: string | null;
  paidAt: string | null;
  vat: number | null;
  tax: number | null;
  filePath: string[] | null;
  status: InvoiceStatus;
  fileSize: number | null;
  viewedAt: string | null;
  fromDetails: EditorDoc | null;
  issueDate: string | null;
  sentAt: string | null;
  template: Template;
  templateId: string | null;
  noteDetails: EditorDoc | null;
  customerName: string | null;
  token: string;
  sentTo: string | null;
  discount: number | null;
  subtotal: number | null;
  topBlock: EditorDoc | null;
  bottomBlock: EditorDoc | null;
  scheduledAt: string | null;
  scheduledJobId: string | null;
  paymentIntentId: string | null;
  refundedAt: string | null;
  teamId: string;
  customer: {
    id: string | null;
    name: string | null;
    website: string | null;
    email: string | null;
    billingEmail: string | null;
    portalId: string | null;
    portalEnabled: boolean | null;
  };
  customerId: string | null;
  team: {
    name: string | null;
    email: string | null;
    stripeConnected: boolean;
  };
  user: {
    email: string | null;
    timezone: string | null;
    locale: string | null;
  };
  invoiceRecurringId: string | null;
  recurringSequence: number | null;
  recurring: {
    id: string | null;
    frequency: InvoiceRecurringFrequency;
    frequencyInterval: number;
    status: string | null;
    nextScheduledAt: string | null;
    endType: string | null;
    endCount: number;
    invoicesGenerated: number;
  };
};

function getProjectedInvoicePayload(
  record: { payload: unknown } | null | undefined,
): ProjectedInvoiceRecord | null {
  const payload = record?.payload as ProjectedInvoiceRecord | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

export async function getProjectedInvoicesForTeam(teamId: string) {
  const records = await getPublicInvoicesByTeamFromConvex({ teamId });

  return records
    .map(getProjectedInvoicePayload)
    .filter(
      (record): record is ProjectedInvoiceRecord =>
        !!record && typeof record === "object" && record.teamId === teamId,
    );
}

export type GetProjectedInvoicesByFiltersParams = {
  teamId: string;
  statuses?: ProjectedInvoiceRecord["status"][];
  currency?: string;
  dateField?: PublicInvoiceFilterDateField;
  from?: string;
  to?: string;
};

export async function getProjectedInvoicesByFilters(
  params: GetProjectedInvoicesByFiltersParams,
) {
  const records = await getPublicInvoicesByFiltersFromConvex({
    teamId: params.teamId,
    statuses: params.statuses,
    currency: params.currency,
    dateField: params.dateField,
    from: params.from,
    to: params.to,
  });

  return records
    .map(getProjectedInvoicePayload)
    .filter(
      (record): record is ProjectedInvoiceRecord =>
        !!record &&
        typeof record === "object" &&
        record.teamId === params.teamId &&
        (!params.currency || record.currency === params.currency) &&
        (!params.statuses || params.statuses.includes(record.status)),
    );
}

export async function getProjectedInvoiceByRecurringSequence(
  teamId: string,
  invoiceRecurringId: string,
  recurringSequence: number,
) {
  const record = await getPublicInvoiceByRecurringSequenceFromConvex({
    teamId,
    invoiceRecurringId,
    recurringSequence,
  });
  const payload = getProjectedInvoicePayload(record);

  if (!payload || payload.teamId !== teamId) {
    return null;
  }

  return payload;
}

export async function getProjectedInvoicesByRecurringId(params: {
  teamId: string;
  invoiceRecurringId: string;
  statuses?: string[];
}) {
  const records = await getPublicInvoicesByRecurringIdFromConvex({
    teamId: params.teamId,
    invoiceRecurringId: params.invoiceRecurringId,
    statuses: params.statuses,
  });

  return records
    .map(getProjectedInvoicePayload)
    .filter(
      (record): record is ProjectedInvoiceRecord =>
        !!record &&
        record.teamId === params.teamId &&
        record.invoiceRecurringId === params.invoiceRecurringId,
    );
}

export async function getInvoiceByPaymentIntentId(paymentIntentId: string) {
  const projected = await getPublicInvoiceByPaymentIntentIdFromConvex({
    paymentIntentId,
  });

  const payload = getProjectedInvoicePayload(projected);

  if (payload?.paymentIntentId === paymentIntentId) {
    return {
      id: payload.id,
      teamId: payload.teamId,
      status: payload.status,
      invoiceNumber: payload.invoiceNumber,
      customerName: payload.customerName,
      paymentIntentId: payload.paymentIntentId,
    };
  }

  return null;
}
