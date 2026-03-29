import {
  getCustomerByIdFromConvex,
  getInvoiceRecurringSeriesByLegacyIdFromConvex,
  upsertPublicInvoiceInConvex,
  type CurrentUserIdentityRecord,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import type { EditorDoc, LineItem } from "@tamias/invoice/types";
import { type InvoiceStatus, type Template } from "../invoice-projections";
import { getInvoiceTemplateById } from "../invoice-templates";
import { getTeamById } from "../teams";
import { getUserByConvexId } from "../users";

export type InvoiceConvexUserId = CurrentUserIdentityRecord["convexId"];

export type InvoiceRecurringFrequency =
  | "weekly"
  | "biweekly"
  | "monthly_date"
  | "monthly_weekday"
  | "monthly_last_day"
  | "quarterly"
  | "semi_annual"
  | "annual"
  | "custom";

export type InvoiceByIdResult = {
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

export type ProjectedInvoiceRecord = InvoiceByIdResult;

export type InvoiceProjectionInput = Omit<
  InvoiceByIdResult,
  "customer" | "team" | "user" | "recurring"
>;

export function getProjectedInvoicePayload(
  record: { payload: unknown } | null | undefined,
): InvoiceByIdResult | null {
  const payload = record?.payload as InvoiceByIdResult | null;

  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload;
}

export function hasOwnKey(object: object, key: string) {
  return Object.hasOwn(object, key);
}

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

export type DraftInvoiceLineItemParams = {
  name?: string | null;
  quantity?: number;
  unit?: string | null;
  price?: number;
  vat?: number | null;
  tax?: number | null;
};

export type DraftInvoiceTemplateParams = {
  customerLabel?: string;
  title?: string;
  fromLabel?: string;
  invoiceNoLabel?: string;
  issueDateLabel?: string;
  dueDateLabel?: string;
  descriptionLabel?: string;
  priceLabel?: string;
  quantityLabel?: string;
  totalLabel?: string;
  totalSummaryLabel?: string;
  vatLabel?: string;
  subtotalLabel?: string;
  taxLabel?: string;
  discountLabel?: string;
  sendCopy?: boolean;
  timezone?: string;
  paymentLabel?: string;
  noteLabel?: string;
  logoUrl?: string | null;
  currency?: string;
  paymentDetails?: string | null;
  fromDetails?: string | null;
  dateFormat?: string;
  includeVat?: boolean;
  includeTax?: boolean;
  includeDiscount?: boolean;
  includeDecimals?: boolean;
  includeUnits?: boolean;
  includeQr?: boolean;
  taxRate?: number | null;
  vatRate?: number | null;
  size?: "a4" | "letter";
  deliveryType?: "create" | "create_and_send" | "scheduled";
  locale?: string;
};

export type DraftInvoiceParams = {
  id: string;
  template: DraftInvoiceTemplateParams;
  templateId?: string | null;
  fromDetails?: string | null;
  customerDetails?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  paymentDetails?: string | null;
  noteDetails?: string | null;
  dueDate: string;
  issueDate: string;
  invoiceNumber: string;
  logoUrl?: string | null;
  vat?: number | null;
  tax?: number | null;
  discount?: number | null;
  subtotal?: number | null;
  topBlock?: string | null;
  bottomBlock?: string | null;
  amount?: number | null;
  lineItems?: DraftInvoiceLineItemParams[];
  token?: string;
  teamId: string;
  userId: InvoiceConvexUserId;
};
