import type { CurrentUserIdentityRecord, TransactionCategoryRecord } from "@tamias/app-data-convex";
import type { transactionFrequencyEnum } from "../../../schema";

export type TransactionConvexUserId = CurrentUserIdentityRecord["convexId"];

export type TransactionFrequency = (typeof transactionFrequencyEnum.enumValues)[number];

export type TransactionTag = {
  id: string;
  name: string | null;
};

export type AssignedTransactionUser = {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
};

export type TransactionAttachmentSummary = {
  id: string;
  name: string | null;
  path: string[] | null;
  type: string | null;
  size: number | null;
};

export type TransactionCategorySummary = {
  id: string;
  name: string;
  color: string | null;
  slug: string;
  taxRate: number | null;
  taxType: string | null;
  description: string | null;
  taxReportingCode: string | null;
};

export type TransactionDerivedState = {
  hasPendingSuggestion: boolean;
  isFulfilled: boolean;
  isExported: boolean;
  hasExportError: boolean;
};

export function buildTransactionCategorySummary(
  category: TransactionCategoryRecord | undefined,
): TransactionCategorySummary | null {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    color: category.color ?? null,
    slug: category.slug,
    taxRate: category.taxRate ?? null,
    taxType: category.taxType ?? null,
    description: category.description ?? null,
    taxReportingCode: category.taxReportingCode ?? null,
  };
}
