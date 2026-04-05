import {
  getTransactionCategoryByIdFromConvex,
  type TransactionCategoryRecord,
} from "../../convex";
import type { Database } from "../../client";
import { getTransactionCategoryContext } from "./context";
import type { GetCategoriesParams, GetCategoryByIdParams } from "./types";

export async function getTransactionCategoryBySlug(
  db: Database,
  params: {
    teamId: string;
    slug: string | null | undefined;
  },
) {
  if (!params.slug) {
    return null;
  }

  const context = await getTransactionCategoryContext(db, params.teamId);
  return context.bySlug.get(params.slug) ?? null;
}

export async function getTransactionCategoriesByIds(
  db: Database,
  params: {
    teamId: string;
    ids: string[];
  },
) {
  if (params.ids.length === 0) {
    return [];
  }

  const context = await getTransactionCategoryContext(db, params.teamId);
  return params.ids
    .map((id) => context.byId.get(id))
    .filter(
      (category): category is TransactionCategoryRecord => Boolean(category),
    );
}

export async function getTransactionCategoriesBySlugs(
  db: Database,
  params: {
    teamId: string;
    slugs: string[];
  },
) {
  if (params.slugs.length === 0) {
    return [];
  }

  const context = await getTransactionCategoryContext(db, params.teamId);
  return params.slugs
    .map((slug) => context.bySlug.get(slug))
    .filter(
      (category): category is TransactionCategoryRecord => Boolean(category),
    );
}

export async function getExpandedTransactionCategorySlugs(
  db: Database,
  params: {
    teamId: string;
    slugs: string[];
  },
) {
  if (params.slugs.length === 0) {
    return [];
  }

  const context = await getTransactionCategoryContext(db, params.teamId);
  const expandedSlugs = new Set<string>();

  for (const slug of params.slugs) {
    const category = context.bySlug.get(slug);

    if (!category) {
      expandedSlugs.add(slug);
      continue;
    }

    expandedSlugs.add(category.slug);

    if (!category.parentId) {
      const children = context.childrenByParentId.get(category.id) ?? [];

      for (const child of children) {
        expandedSlugs.add(child.slug);
      }
    }
  }

  return [...expandedSlugs];
}

export async function getExcludedTransactionCategorySlugs(
  db: Database,
  teamId: string,
) {
  const context = await getTransactionCategoryContext(db, teamId);
  return [...context.excludedSlugs];
}

export const getCategories = async (
  db: Database,
  params: GetCategoriesParams,
) => {
  const { teamId, limit = 1000 } = params;
  const context = await getTransactionCategoryContext(db, teamId);
  const parentCategories = context.categories
    .filter((category) => !category.parentId)
    .slice(0, limit);

  return parentCategories.map((parent) => ({
    ...parent,
    children: context.childrenByParentId.get(parent.id) ?? [],
  }));
};

export const getCategoryById = async (
  db: Database,
  params: GetCategoryByIdParams,
) => {
  const result = await getTransactionCategoryByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });

  if (!result) {
    return null;
  }

  const context = await getTransactionCategoryContext(db, params.teamId);

  return {
    ...result,
    children: context.childrenByParentId.get(result.id) ?? [],
  };
};
