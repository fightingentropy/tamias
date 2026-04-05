import type { LineItem } from "@tamias/invoice/types";
import {
  createInvoiceProductInConvex,
  deleteInvoiceProductInConvex,
  getInvoiceProductByIdFromConvex,
  getInvoiceProductsFromConvex,
  incrementInvoiceProductUsageInConvex,
  type CurrentUserIdentityRecord,
  type InvoiceProductRecord,
  updateInvoiceProductInConvex,
  upsertInvoiceProductInConvex,
} from "../convex";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

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
  createdBy: ConvexUserId;
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
  params: CreateInvoiceProductParams,
): Promise<InvoiceProduct> {
  return toInvoiceProduct(
    await createInvoiceProductInConvex({
      teamId: params.teamId,
      userId: params.createdBy,
      name: params.name,
      description: params.description,
      price: params.price,
      currency: params.currency,
      unit: params.unit,
      taxRate: params.taxRate,
      isActive: params.isActive,
    }),
  );
}

export type UpsertInvoiceProductParams = {
  teamId: string;
  createdBy: ConvexUserId;
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  unit?: string | null;
  taxRate?: number | null;
};

export async function upsertInvoiceProduct(
  params: UpsertInvoiceProductParams,
): Promise<InvoiceProduct> {
  return toInvoiceProduct(
    await upsertInvoiceProductInConvex({
      teamId: params.teamId,
      userId: params.createdBy,
      name: params.name,
      description: params.description,
      price: params.price,
      currency: params.currency,
      unit: params.unit,
      taxRate: params.taxRate,
    }),
  );
}

export async function updateInvoiceProduct(
  params: UpdateInvoiceProductParams,
): Promise<InvoiceProduct | null> {
  const { id, teamId, ...updates } = params;
  const result = await updateInvoiceProductInConvex({
    id,
    teamId,
    ...updates,
  });

  return result ? toInvoiceProduct(result) : null;
}

export async function getInvoiceProductById(
  id: string,
  teamId: string,
): Promise<InvoiceProduct | null> {
  const result = await getInvoiceProductByIdFromConvex({ id, teamId });
  return result ? toInvoiceProduct(result) : null;
}

export type GetInvoiceProductsParams = {
  sortBy?: "popular" | "recent";
  limit?: number;
  includeInactive?: boolean;
  currency?: string | null;
};

export async function incrementProductUsage(
  id: string,
  teamId: string,
): Promise<void> {
  await incrementInvoiceProductUsageInConvex({ id, teamId });
}

export async function getPopularInvoiceProducts(
  teamId: string,
  limit = 20,
): Promise<InvoiceProduct[]> {
  return (
    await getInvoiceProductsFromConvex({
      teamId,
      sortBy: "popular",
      limit,
      includeInactive: false,
    })
  ).map(toInvoiceProduct);
}

export async function getRecentInvoiceProducts(
  teamId: string,
  limit = 10,
): Promise<InvoiceProduct[]> {
  return (
    await getInvoiceProductsFromConvex({
      teamId,
      sortBy: "recent",
      limit,
      includeInactive: false,
    })
  ).map(toInvoiceProduct);
}

export async function getInvoiceProducts(
  teamId: string,
  params: GetInvoiceProductsParams = {},
): Promise<InvoiceProduct[]> {
  return (
    await getInvoiceProductsFromConvex({
      teamId,
      sortBy: params.sortBy,
      limit: params.limit,
      includeInactive: params.includeInactive,
      currency: params.currency,
    })
  ).map(toInvoiceProduct);
}

export async function deleteInvoiceProduct(
  id: string,
  teamId: string,
): Promise<boolean> {
  return deleteInvoiceProductInConvex({ id, teamId });
}

export async function saveLineItemAsProduct(
  teamId: string,
  userId: ConvexUserId,
  lineItem: LineItem,
  currency?: string,
): Promise<{ product: InvoiceProduct | null; shouldClearProductId: boolean }> {
  if (!lineItem.name || lineItem.name.trim().length === 0) {
    return { product: null, shouldClearProductId: true };
  }

  const trimmedName = lineItem.name.trim();

  try {
    if (lineItem.productId) {
      const existingProduct = await getInvoiceProductById(
        lineItem.productId,
        teamId,
      );

      if (existingProduct) {
        const updatedProduct = await updateInvoiceProduct({
          id: lineItem.productId,
          teamId,
          name: trimmedName,
          price:
            lineItem.price !== undefined
              ? lineItem.price
              : existingProduct.price,
          currency: currency || existingProduct.currency,
          unit:
            lineItem.unit !== undefined ? lineItem.unit : existingProduct.unit,
          lastUsedAt: new Date().toISOString(),
        });

        return { product: updatedProduct, shouldClearProductId: false };
      }
    }

    const product = await upsertInvoiceProduct({
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
