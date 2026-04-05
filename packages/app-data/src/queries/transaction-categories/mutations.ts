import {
  createActivityInConvex,
  createTransactionCategoryInConvex,
  deleteTransactionCategoryInConvex,
  getTransactionCategoryByIdFromConvex,
  updateTransactionCategoryInConvex,
} from "../../convex";
import type { Database } from "../../client";
import { invalidateTransactionCategoryContext } from "./context";
import { generateCategoryEmbedding } from "./embeddings";
import type {
  CreateTransactionCategoryParams,
  DeleteTransactionCategoryParams,
  UpdateTransactionCategoryParams,
} from "./types";

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
