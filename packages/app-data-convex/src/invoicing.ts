import type { ConvexUserId } from "./base";
import { api, createClient, serviceArgs } from "./base";

export type InvoiceProductRecord = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  teamId: string;
  createdBy: ConvexUserId | null;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  unit: string | null;
  taxRate: number | null;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
};

export type InvoiceTemplateSize = "a4" | "letter";
export type InvoiceTemplateDeliveryType =
  | "create"
  | "create_and_send"
  | "scheduled";

export type InvoiceTemplateRecord = {
  id: string;
  name: string;
  isDefault: boolean;
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

export async function getInvoiceProductsFromConvex(args: {
  teamId: string;
  sortBy?: "popular" | "recent";
  limit?: number;
  includeInactive?: boolean;
  currency?: string | null;
}) {
  return createClient().query(
    api.invoiceProducts.serviceGetInvoiceProducts,
    serviceArgs({
      publicTeamId: args.teamId,
      sortBy: args.sortBy,
      limit: args.limit,
      includeInactive: args.includeInactive,
      currency: args.currency,
    }),
  ) as Promise<InvoiceProductRecord[]>;
}

export async function getInvoiceProductByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.invoiceProducts.serviceGetInvoiceProductById,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<InvoiceProductRecord | null>;
}

export async function createInvoiceProductInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceCreateInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
      isActive: args.isActive,
    }),
  ) as Promise<InvoiceProductRecord>;
}

export async function upsertInvoiceProductInConvex(args: {
  teamId: string;
  userId: ConvexUserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceUpsertInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      userId: args.userId,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
    }),
  ) as Promise<InvoiceProductRecord>;
}

export async function updateInvoiceProductInConvex(args: {
  teamId: string;
  id: string;
  name?: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceUpdateInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
      name: args.name,
      description: args.description,
      price: args.price,
      currency: args.currency,
      unit: args.unit,
      taxRate: args.taxRate,
      isActive: args.isActive,
      usageCount: args.usageCount,
      lastUsedAt: args.lastUsedAt,
    }),
  ) as Promise<InvoiceProductRecord | null>;
}

export async function deleteInvoiceProductInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceDeleteInvoiceProduct,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<boolean>;
}

export async function incrementInvoiceProductUsageInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceProducts.serviceIncrementInvoiceProductUsage,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceProductId: args.id,
    }),
  ) as Promise<{ success: boolean }>;
}

export async function getInvoiceTemplatesFromConvex(args: { teamId: string }) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplates,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceTemplateRecord[]>;
}

export async function getInvoiceTemplateByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplateById,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateRecord | null>;
}

export async function getDefaultInvoiceTemplateFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<InvoiceTemplateRecord | null>;
}

export async function createInvoiceTemplateInConvex(args: {
  teamId: string;
  name: string;
  isDefault?: boolean;
  templateData?: Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceCreateInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      name: args.name,
      isDefault: args.isDefault,
      templateData: args.templateData,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function upsertInvoiceTemplateInConvex(args: {
  teamId: string;
  id?: string;
  name?: string;
  templateData?: Omit<InvoiceTemplateRecord, "id" | "name" | "isDefault">;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceUpsertInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
      name: args.name,
      templateData: args.templateData,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function setDefaultInvoiceTemplateInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceSetDefaultInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateRecord>;
}

export async function deleteInvoiceTemplateInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    api.invoiceTemplates.serviceDeleteInvoiceTemplate,
    serviceArgs({
      publicTeamId: args.teamId,
      invoiceTemplateId: args.id,
    }),
  ) as Promise<InvoiceTemplateDeleteResult>;
}

export async function getInvoiceTemplateCountFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    api.invoiceTemplates.serviceGetInvoiceTemplateCount,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<number>;
}
