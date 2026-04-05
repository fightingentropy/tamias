import {
  getTransactionCategoryEmbeddingsByNamesFromConvex,
  upsertTransactionCategoryEmbeddingsInConvex,
} from "../convex";
import type { Database } from "../client";

export type GetCategoryEmbeddingParams = {
  name: string;
};

export const getCategoryEmbedding = async (
  _db: Database,
  params: GetCategoryEmbeddingParams,
) => {
  const [result] = await getTransactionCategoryEmbeddingsByNamesFromConvex({
    names: [params.name],
  });

  return result ?? null;
};

export type GetCategoryEmbeddingsByNamesParams = {
  names: string[];
};

export const getCategoryEmbeddingsByNames = async (
  _db: Database,
  params: GetCategoryEmbeddingsByNamesParams,
) => {
  if (params.names.length === 0) {
    return [];
  }

  return getTransactionCategoryEmbeddingsByNamesFromConvex({
    names: params.names,
  });
};

export type CreateCategoryEmbeddingParams = {
  name: string;
  embedding: number[];
  system?: boolean;
  model?: string;
};

export const createCategoryEmbedding = async (
  db: Database,
  params: CreateCategoryEmbeddingParams,
) => {
  return upsertCategoryEmbedding(db, params);
};

export type UpsertCategoryEmbeddingParams = {
  name: string;
  embedding: number[];
  system?: boolean;
  model?: string;
};

export const upsertCategoryEmbedding = async (
  _db: Database,
  params: UpsertCategoryEmbeddingParams,
) => {
  const [result] = await upsertTransactionCategoryEmbeddingsInConvex({
    embeddings: [
      {
        name: params.name,
        embedding: params.embedding,
        system: params.system,
        model: params.model,
      },
    ],
  });

  return result;
};
