import type { Database } from "../client";
import {
  createInvoiceTemplateInD1,
  deleteInvoiceTemplateFromD1,
  getDefaultInvoiceTemplateFromD1,
  getInvoiceTemplateByIdFromD1,
  getInvoiceTemplateCountFromD1,
  getInvoiceTemplatesD1,
  getInvoiceTemplatesFromD1,
  setDefaultInvoiceTemplateInD1,
  upsertInvoiceTemplateInD1,
} from "./invoice-templates/d1";

export type InvoiceTemplateSize = "a4" | "letter";
export type InvoiceTemplateDeliveryType = "create" | "create_and_send" | "scheduled";

export type InvoiceTemplateRecord = {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string | null;
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
  paymentLabel?: string;
  noteLabel?: string;
  logoUrl?: string | null;
  currency?: string;
  paymentDetails?: unknown | null;
  fromDetails?: unknown | null;
  noteDetails?: unknown | null;
  dateFormat?: string;
  includeVat?: boolean;
  includeTax?: boolean;
  includeDiscount?: boolean;
  includeDecimals?: boolean;
  includeUnits?: boolean;
  includeQr?: boolean;
  includeLineItemTax?: boolean;
  lineItemTaxLabel?: string;
  taxRate?: number | null;
  vatRate?: number | null;
  size?: InvoiceTemplateSize;
  deliveryType?: InvoiceTemplateDeliveryType;
  includePdf?: boolean;
  paymentEnabled?: boolean;
  paymentTermsDays?: number;
  emailSubject?: string | null;
  emailHeading?: string | null;
  emailBody?: string | null;
  emailButtonText?: string | null;
};

export type InvoiceTemplateDeleteResult = {
  deleted: InvoiceTemplateRecord;
  newDefault: InvoiceTemplateRecord | null;
};

export type InvoiceTemplateParams = Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;

export type CreateInvoiceTemplateParams = {
  teamId: string;
  name: string;
  isDefault?: boolean;
} & InvoiceTemplateParams;

export type UpsertInvoiceTemplateParams = {
  id?: string;
  teamId: string;
  name?: string;
} & InvoiceTemplateParams;

export type InvoiceTemplate = InvoiceTemplateRecord;

function requireInvoiceTemplatesD1(db: Database) {
  const d1 = getInvoiceTemplatesD1(db);

  if (!d1) {
    throw new Error("Invoice templates require Cloudflare D1");
  }

  return d1;
}

export async function getInvoiceTemplates(db: Database, teamId: string) {
  return getInvoiceTemplatesFromD1(requireInvoiceTemplatesD1(db), teamId);
}

export async function getInvoiceTemplateById(db: Database, params: { id: string; teamId: string }) {
  return getInvoiceTemplateByIdFromD1(requireInvoiceTemplatesD1(db), params);
}

export async function getInvoiceTemplate(db: Database, teamId: string) {
  return getDefaultInvoiceTemplateFromD1(requireInvoiceTemplatesD1(db), teamId);
}

export async function createInvoiceTemplate(db: Database, params: CreateInvoiceTemplateParams) {
  return createInvoiceTemplateInD1(requireInvoiceTemplatesD1(db), params);
}

export async function upsertInvoiceTemplate(db: Database, params: UpsertInvoiceTemplateParams) {
  return upsertInvoiceTemplateInD1(requireInvoiceTemplatesD1(db), params);
}

export async function setDefaultTemplate(db: Database, params: { id: string; teamId: string }) {
  return setDefaultInvoiceTemplateInD1(requireInvoiceTemplatesD1(db), params);
}

export async function deleteInvoiceTemplate(
  db: Database,
  params: {
    id: string;
    teamId: string;
  },
): Promise<InvoiceTemplateDeleteResult> {
  return deleteInvoiceTemplateFromD1(requireInvoiceTemplatesD1(db), params);
}

export async function getInvoiceTemplateCount(db: Database, teamId: string) {
  return getInvoiceTemplateCountFromD1(requireInvoiceTemplatesD1(db), teamId);
}
