import type { transactionFrequencyEnum } from "../../../schema";
import type { TransactionCategoryRecord } from "../../transaction-categories/d1";

export type TransactionUserId = string;

export type TransactionMethod =
  | "payment"
  | "card_purchase"
  | "card_atm"
  | "transfer"
  | "other"
  | "unknown"
  | "ach"
  | "interest"
  | "deposit"
  | "wire"
  | "fee";

export type TransactionStatus =
  | "posted"
  | "pending"
  | "excluded"
  | "completed"
  | "archived"
  | "exported";

export type TransactionFrequency = (typeof transactionFrequencyEnum.enumValues)[number];

export type TransactionRecord = {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId: string | null;
  note: string | null;
  bankAccountId: string | null;
  internalId: string;
  status: TransactionStatus;
  balance: number | null;
  manual: boolean;
  notified: boolean;
  internal: boolean;
  description: string | null;
  categorySlug: string | null;
  baseAmount: number | null;
  counterpartyName: string | null;
  baseCurrency: string | null;
  taxAmount: number | null;
  taxRate: number | null;
  taxType: string | null;
  recurring: boolean;
  frequency: TransactionFrequency | null;
  merchantName: string | null;
  enrichmentCompleted: boolean;
  hasAttachment: boolean;
};

export type UpsertTransactionInput = {
  id: string;
  createdAt: string;
  date: string;
  name: string;
  method: TransactionMethod;
  amount: number;
  currency: string;
  assignedId?: string | null;
  note?: string | null;
  bankAccountId?: string | null;
  internalId: string;
  status: TransactionStatus;
  balance?: number | null;
  manual: boolean;
  notified?: boolean | null;
  internal?: boolean | null;
  description?: string | null;
  categorySlug?: string | null;
  baseAmount?: number | null;
  counterpartyName?: string | null;
  baseCurrency?: string | null;
  taxAmount?: number | null;
  taxRate?: number | null;
  taxType?: string | null;
  recurring?: boolean | null;
  frequency?: TransactionFrequency | null;
  merchantName?: string | null;
  enrichmentCompleted?: boolean | null;
  hasAttachment?: boolean | null;
};

export type TransactionTag = {
  id: string;
  name: string | null;
};

export type TransactionTagAssignmentRecord = {
  id: string;
  transactionId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  tag: {
    id: string;
    name: string;
  };
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
