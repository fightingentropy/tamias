import {
  createActivityInConvex,
  createTransactionCategoryInConvex,
  deleteTransactionCategoryInConvex,
  getTransactionCategoryEmbeddingsByNamesFromConvex,
  getTransactionCategoriesFromConvex,
  getTransactionCategoryByIdFromConvex,
  type CurrentUserIdentityRecord,
  type TransactionCategoryRecord,
  upsertTransactionCategoryEmbeddingsInConvex,
  updateTransactionCategoryInConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../client";
import { CategoryEmbeddings } from "@tamias/categories";
import { logger } from "@tamias/logger";

type ConvexUserId = CurrentUserIdentityRecord["convexId"];

type TransactionCategoryContext = {
  categories: TransactionCategoryRecord[];
  byId: Map<string, TransactionCategoryRecord>;
  bySlug: Map<string, TransactionCategoryRecord>;
  childrenByParentId: Map<string, TransactionCategoryRecord[]>;
  excludedSlugs: Set<string>;
  includedSlugs: Set<string>;
};

type CachedTransactionCategoryContext = {
  context: TransactionCategoryContext;
  timestamp: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const transactionCategoryContextCache = new Map<
  string,
  CachedTransactionCategoryContext
>();

async function generateCategoryEmbedding(
  _db: Database,
  params: {
    name: string;
    system?: boolean;
  },
) {
  const { name, system = false } = params;

  try {
    const [existingEmbedding] = await getTransactionCategoryEmbeddingsByNamesFromConvex({
      names: [name],
    });

    if (existingEmbedding) {
      logger.info(`Embedding already exists for category: "${name}"`);
      return;
    }

    const embedService = new CategoryEmbeddings();
    const { embedding, model } = await embedService.embed(name);

    await upsertTransactionCategoryEmbeddingsInConvex({
      embeddings: [
        {
          name,
          embedding,
          system,
          model,
        },
      ],
    });

    logger.info(`Generated embedding for category: "${name}"`);
  } catch (error) {
    logger.error(`Failed to generate embedding for "${name}"`, { error });
  }
}

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
        Number(right.system) - Number(left.system) ||
        left.name.localeCompare(right.name),
    ),
    byId,
    bySlug,
    childrenByParentId,
    excludedSlugs,
    includedSlugs,
  };
}

function invalidateTransactionCategoryContext(teamId: string) {
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
    .filter((category): category is TransactionCategoryRecord => Boolean(category));
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
    .filter((category): category is TransactionCategoryRecord => Boolean(category));
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

export type GetCategoriesParams = {
  teamId: string;
  limit?: number;
};

export type GetCategoryByIdParams = {
  id: string;
  teamId: string;
};

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
  _db: Database,
  params: GetCategoryByIdParams,
) => {
  const result = await getTransactionCategoryByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });

  if (!result) {
    return null;
  }

  const context = await getTransactionCategoryContext(_db, params.teamId);

  return {
    ...result,
    children: context.childrenByParentId.get(result.id) ?? [],
  };
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

export const createTransactionCategory = async (
  db: Database,
  params: CreateTransactionCategoryParams,
) => {
  const result = await createTransactionCategoryInConvex({
    teamId: params.teamId,
    name: params.name,
    color: params.color,
    description: params.description,
    taxRate: params.taxRate,
    taxType: params.taxType,
    taxReportingCode: params.taxReportingCode,
    parentId: params.parentId,
  });

  invalidateTransactionCategoryContext(params.teamId);

  void createActivityInConvex({
    teamId: params.teamId,
    userId: params.userId,
    type: "transaction_category_created",
    source: "user",
    priority: 7,
    metadata: {
      categoryId: result.id,
      categoryName: result.name,
      categoryColor: result.color,
      categoryDescription: result.description,
      taxRate: result.taxRate,
      taxType: result.taxType,
      taxReportingCode: result.taxReportingCode,
      parentId: result.parentId,
    },
  });

  generateCategoryEmbedding(db, {
    name: result.name,
    system: result.system,
  }).catch((error) => {
    console.error(
      `Failed to generate embedding for category "${result.name}":`,
      error,
    );
  });

  return result;
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

export const updateTransactionCategory = async (
  db: Database,
  params: UpdateTransactionCategoryParams,
) => {
  const existing = await getTransactionCategoryByIdFromConvex({
    teamId: params.teamId,
    id: params.id,
  });

  if (!existing) {
    return null;
  }

  const result = await updateTransactionCategoryInConvex({
    teamId: params.teamId,
    id: params.id,
    name: params.name ?? existing.name,
    color: params.color !== undefined ? params.color : existing.color,
    description:
      params.description !== undefined
        ? params.description
        : existing.description,
    taxRate: params.taxRate !== undefined ? params.taxRate : existing.taxRate,
    taxType: params.taxType !== undefined ? params.taxType : existing.taxType,
    taxReportingCode:
      params.taxReportingCode !== undefined
        ? params.taxReportingCode
        : existing.taxReportingCode,
    parentId: params.parentId !== undefined ? params.parentId : existing.parentId,
    excluded: existing.excluded,
  });

  invalidateTransactionCategoryContext(params.teamId);

  if (params.name && params.name !== existing.name) {
    generateCategoryEmbedding(db, {
      name: params.name,
      system: result.system,
    }).catch((error) => {
      console.error(
        `Failed to update embedding for category "${params.name}":`,
        error,
      );
    });
  }

  return result;
};

export type DeleteTransactionCategoryParams = {
  id: string;
  teamId: string;
};

export const deleteTransactionCategory = async (
  _db: Database,
  params: DeleteTransactionCategoryParams,
) => {
  const result = await deleteTransactionCategoryInConvex({
    teamId: params.teamId,
    id: params.id,
  });

  invalidateTransactionCategoryContext(params.teamId);

  return result;
};
