import { api, convexApi, createClient, serviceArgs } from "./base";

export type TransactionCategoryRecord = {
  id: string;
  teamId: string;
  name: string;
  color: string | null;
  slug: string;
  description: string | null;
  system: boolean;
  taxRate: number | null;
  taxType: string | null;
  taxReportingCode: string | null;
  excluded: boolean;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionCategoryInput = {
  id?: string;
  teamId: string;
  name: string;
  slug?: string;
  color?: string | null;
  description?: string | null;
  system?: boolean;
  taxRate?: number | null;
  taxType?: string | null;
  taxReportingCode?: string | null;
  excluded?: boolean | null;
  parentId?: string | null;
};

export type TransactionCategoryEmbeddingRecord = {
  name: string;
  embedding: number[];
  model: string;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertTransactionCategoryEmbeddingInput = {
  name: string;
  embedding: number[];
  system?: boolean;
  model?: string;
};

export async function getTransactionCategoryEmbeddingsByNamesFromConvex(args: {
  names: string[];
}) {
  return createClient().query(
    api.transactionCategoryEmbeddings
      .serviceGetTransactionCategoryEmbeddingsByNames,
    serviceArgs({
      names: args.names,
    }),
  ) as Promise<TransactionCategoryEmbeddingRecord[]>;
}

export async function upsertTransactionCategoryEmbeddingsInConvex(args: {
  embeddings: UpsertTransactionCategoryEmbeddingInput[];
}) {
  return createClient().mutation(
    api.transactionCategoryEmbeddings
      .serviceUpsertTransactionCategoryEmbeddings,
    serviceArgs({
      embeddings: args.embeddings,
    }),
  ) as Promise<TransactionCategoryEmbeddingRecord[]>;
}

export async function getTransactionCategoriesFromConvex(args: {
  teamId: string;
}) {
  return createClient().query(
    convexApi.transactionCategories.serviceListTransactionCategories,
    serviceArgs({
      publicTeamId: args.teamId,
    }),
  ) as Promise<TransactionCategoryRecord[]>;
}

export async function getTransactionCategoryByIdFromConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().query(
    convexApi.transactionCategories.serviceGetTransactionCategoryById,
    serviceArgs({
      publicTeamId: args.teamId,
      categoryId: args.id,
    }),
  ) as Promise<TransactionCategoryRecord | null>;
}

export async function createTransactionCategoryInConvex(
  args: UpsertTransactionCategoryInput,
) {
  return createClient().mutation(
    convexApi.transactionCategories.serviceCreateTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
      name: args.name,
      color: args.color,
      description: args.description,
      system: args.system,
      taxRate: args.taxRate,
      taxType: args.taxType,
      taxReportingCode: args.taxReportingCode,
      excluded: args.excluded,
      parentId: args.parentId,
    }),
  ) as Promise<TransactionCategoryRecord>;
}

export async function updateTransactionCategoryInConvex(
  args: UpsertTransactionCategoryInput & { id: string },
) {
  return createClient().mutation(
    convexApi.transactionCategories.serviceUpdateTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
      name: args.name,
      color: args.color,
      description: args.description,
      taxRate: args.taxRate,
      taxType: args.taxType,
      taxReportingCode: args.taxReportingCode,
      excluded: args.excluded,
      parentId: args.parentId,
    }),
  ) as Promise<TransactionCategoryRecord>;
}

export async function deleteTransactionCategoryInConvex(args: {
  teamId: string;
  id: string;
}) {
  return createClient().mutation(
    convexApi.transactionCategories.serviceDeleteTransactionCategory,
    serviceArgs({
      publicTeamId: args.teamId,
      id: args.id,
    }),
  ) as Promise<{ id: string } | null>;
}

export async function upsertTransactionCategoriesInConvex(args: {
  teamId: string;
  categories: UpsertTransactionCategoryInput[];
}) {
  return createClient().mutation(
    convexApi.transactionCategories.serviceUpsertTransactionCategories,
    serviceArgs({
      publicTeamId: args.teamId,
      categories: args.categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        color: category.color,
        description: category.description,
        system: category.system,
        taxRate: category.taxRate,
        taxType: category.taxType,
        taxReportingCode: category.taxReportingCode,
        excluded: category.excluded,
        parentId: category.parentId,
      })),
    }),
  ) as Promise<TransactionCategoryRecord[]>;
}
