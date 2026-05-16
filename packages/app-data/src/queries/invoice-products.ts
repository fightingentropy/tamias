import type { LineItem } from "@tamias/invoice/types";
import type { Database } from "../client";
import {
  createInvoiceProductInD1,
  deleteInvoiceProductFromD1,
  getInvoiceProductByIdFromD1,
  getInvoiceProductsD1,
  getInvoiceProductsFromD1,
  incrementInvoiceProductUsageInD1,
  updateInvoiceProductInD1,
  upsertInvoiceProductInD1,
} from "./invoice-products/d1";

type UserId = string;

export type InvoiceProduct = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  teamId: string;
  createdBy: string | null;
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

export type InvoiceProductRecord = {
  id: string;
  createdAt: string;
  updatedAt: string | null;
  teamId: string;
  createdBy: UserId | null;
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

function requireInvoiceProductsD1(db: Database) {
  const d1 = getInvoiceProductsD1(db);

  if (!d1) {
    throw new Error("Invoice products require Cloudflare D1");
  }

  return d1;
}

function toInvoiceProduct(record: InvoiceProductRecord): InvoiceProduct {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    teamId: record.teamId,
    createdBy: record.createdBy,
    name: record.name,
    description: record.description,
    price: record.price,
    currency: record.currency,
    unit: record.unit,
    taxRate: record.taxRate,
    isActive: record.isActive,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt,
  };
}

export type CreateInvoiceProductParams = {
  teamId: string;
  createdBy: UserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
};

export type UpdateInvoiceProductParams = {
  id: string;
  teamId: string;
  name?: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
  isActive?: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
};

export async function createInvoiceProduct(
  db: Database,
  params: CreateInvoiceProductParams,
): Promise<InvoiceProduct> {
  return toInvoiceProduct(await createInvoiceProductInD1(requireInvoiceProductsD1(db), params));
}

export type UpsertInvoiceProductParams = {
  teamId: string;
  createdBy: UserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
};

export async function upsertInvoiceProduct(
  db: Database,
  params: UpsertInvoiceProductParams,
): Promise<InvoiceProduct> {
  return toInvoiceProduct(await upsertInvoiceProductInD1(requireInvoiceProductsD1(db), params));
}

export async function updateInvoiceProduct(
  db: Database,
  params: UpdateInvoiceProductParams,
): Promise<InvoiceProduct | null> {
  const result = await updateInvoiceProductInD1(requireInvoiceProductsD1(db), params);
  return result ? toInvoiceProduct(result) : null;
}

export async function getInvoiceProductById(
  db: Database,
  id: string,
  teamId: string,
): Promise<InvoiceProduct | null> {
  const result = await getInvoiceProductByIdFromD1(requireInvoiceProductsD1(db), id, teamId);
  return result ? toInvoiceProduct(result) : null;
}

export type GetInvoiceProductsParams = {
  sortBy?: "popular" | "recent";
  limit?: number;
  includeInactive?: boolean;
  currency?: string | null;
};

export async function incrementProductUsage(
  db: Database,
  id: string,
  teamId: string,
): Promise<void> {
  await incrementInvoiceProductUsageInD1(requireInvoiceProductsD1(db), id, teamId);
}

export async function getPopularInvoiceProducts(
  db: Database,
  teamId: string,
  limit = 20,
): Promise<InvoiceProduct[]> {
  return getInvoiceProducts(db, teamId, {
    sortBy: "popular",
    limit,
    includeInactive: false,
  });
}

export async function getRecentInvoiceProducts(
  db: Database,
  teamId: string,
  limit = 10,
): Promise<InvoiceProduct[]> {
  return getInvoiceProducts(db, teamId, {
    sortBy: "recent",
    limit,
    includeInactive: false,
  });
}

export async function getInvoiceProducts(
  db: Database,
  teamId: string,
  params: GetInvoiceProductsParams = {},
): Promise<InvoiceProduct[]> {
  return (await getInvoiceProductsFromD1(requireInvoiceProductsD1(db), teamId, params)).map(
    toInvoiceProduct,
  );
}

export async function deleteInvoiceProduct(
  db: Database,
  id: string,
  teamId: string,
): Promise<boolean> {
  return deleteInvoiceProductFromD1(requireInvoiceProductsD1(db), id, teamId);
}

export async function saveLineItemAsProduct(
  db: Database,
  teamId: string,
  userId: UserId,
  lineItem: LineItem,
  currency?: string,
): Promise<{ product: InvoiceProduct | null; shouldClearProductId: boolean }> {
  if (!lineItem.name || lineItem.name.trim().length === 0) {
    return { product: null, shouldClearProductId: true };
  }

  const trimmedName = lineItem.name.trim();

  try {
    if (lineItem.productId) {
      const existingProduct = await getInvoiceProductById(db, lineItem.productId, teamId);

      if (existingProduct) {
        const updatedProduct = await updateInvoiceProduct(db, {
          id: lineItem.productId,
          teamId,
          name: trimmedName,
          price: lineItem.price !== undefined ? lineItem.price : existingProduct.price,
          currency: currency || existingProduct.currency,
          unit: lineItem.unit !== undefined ? lineItem.unit : existingProduct.unit,
          lastUsedAt: new Date().toISOString(),
        });

        return { product: updatedProduct, shouldClearProductId: false };
      }
    }

    const product = await upsertInvoiceProduct(db, {
      teamId,
      createdBy: userId,
      name: trimmedName,
      description: null,
      price: lineItem.price !== undefined ? lineItem.price : null,
      currency: currency || null,
      unit: lineItem.unit !== undefined ? lineItem.unit : null,
    });

    return { product, shouldClearProductId: false };
  } catch {
    return { product: null, shouldClearProductId: true };
  }
}
