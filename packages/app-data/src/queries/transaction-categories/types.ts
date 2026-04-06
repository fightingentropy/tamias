import type {
  CurrentUserIdentityRecord,
  TransactionCategoryRecord,
} from "@tamias/app-data-convex";

export type ConvexUserId = CurrentUserIdentityRecord["convexId"];

export type TransactionCategoryContext = {
  categories: TransactionCategoryRecord[];
  byId: Map<string, TransactionCategoryRecord>;
  bySlug: Map<string, TransactionCategoryRecord>;
  childrenByParentId: Map<string, TransactionCategoryRecord[]>;
  excludedSlugs: Set<string>;
  includedSlugs: Set<string>;
};

export type GetCategoriesParams = {
  teamId: string;
  limit?: number;
};

export type GetCategoryByIdParams = {
  id: string;
  teamId: string;
};

export type CreateTransactionCategoryParams = {
  teamId: string;
  userId?: ConvexUserId;
  name: string;
  color?: string | null;
  description?: string | null;
  taxRate?: number | null;
  taxType?: string | null;
  taxReportingCode?: string | null;
  parentId?: string | null;
};

export type UpdateTransactionCategoryParams = {
  id: string;
  teamId: string;
  name?: string;
  color?: string | null;
  description?: string | null;
  taxRate?: number | null;
  taxType?: string | null;
  taxReportingCode?: string | null;
  parentId?: string | null;
};

export type DeleteTransactionCategoryParams = {
  id: string;
  teamId: string;
};
