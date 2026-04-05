import type { CurrentUserIdentityRecord } from "../../../convex";
import type { EditorDoc, LineItem } from "@tamias/invoice/types";
import { type InvoiceStatus, type Template } from "../../invoice-projections";

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
