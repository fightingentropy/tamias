import {
  getTransactionCategoriesFromConvex,
  type TransactionCategoryRecord,
} from "@tamias/app-data-convex";
import type { Database } from "../../client";
import type { TransactionCategoryContext } from "./types";

type CachedTransactionCategoryContext = {
  context: TransactionCategoryContext;
  timestamp: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const transactionCategoryContextCache = new Map<string, CachedTransactionCategoryContext>();

function buildTransactionCategoryContext(
  categories: TransactionCategoryRecord[],
): TransactionCategoryContext {
  const byId = new Map<string, TransactionCategoryRecord>();
  const bySlug = new Map<string, TransactionCategoryRecord>();
  const childrenByParentId = new Map<string, TransactionCategoryRecord[]>();
  const excludedSlugs = new Set<string>();
  const includedSlugs = new Set<string>();

  for (const category of categories) {
    byId.set(category.id, category);
    bySlug.set(category.slug, category);

    if (category.excluded) {
      excludedSlugs.add(category.slug);
    } else {
      includedSlugs.add(category.slug);
    }

    if (category.parentId) {
      const children = childrenByParentId.get(category.parentId) ?? [];
      children.push(category);
      childrenByParentId.set(category.parentId, children);
    }
  }

  for (const children of childrenByParentId.values()) {
    children.sort((left, right) => left.name.localeCompare(right.name));
  }

  return {
    categories: [...categories].sort(
      (left, right) =>
        Number(right.system) - Number(left.system) || left.name.localeCompare(right.name),
    ),
    byId,
    bySlug,
    childrenByParentId,
    excludedSlugs,
    includedSlugs,
  };
}

export function invalidateTransactionCategoryContext(teamId: string) {
  transactionCategoryContextCache.delete(teamId);
}

export async function getTransactionCategoryContext(
  _db: Database,
  teamId: string,
): Promise<TransactionCategoryContext> {
  const cached = transactionCategoryContextCache.get(teamId);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.context;
  }

  const categories = await getTransactionCategoriesFromConvex({ teamId });
  const context = buildTransactionCategoryContext(categories);

  transactionCategoryContextCache.set(teamId, {
    context,
    timestamp: Date.now(),
  });

  return context;
}
