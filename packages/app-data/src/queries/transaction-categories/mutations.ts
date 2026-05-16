import type { Database } from "../../client";
import { createActivity } from "../activities";
import { rebuildDerivedComplianceJournalEntries } from "../compliance/ledger";
import { invalidateTransactionCategoryContext } from "./context";
import {
  deleteTransactionCategoryRecord,
  getTransactionCategoryRecordById,
  upsertTransactionCategoryRecord,
  upsertTransactionCategoryRecords,
  type UpsertTransactionCategoryInput,
} from "./d1";
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
  const result = await upsertTransactionCategoryRecord(db, {
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
  await rebuildDerivedComplianceJournalEntries(db, {
    teamId: params.teamId,
  });

  void createActivity(db, {
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
    console.error(`Failed to generate embedding for category "${result.name}":`, error);
  });

  return result;
};

export const updateTransactionCategory = async (
  db: Database,
  params: UpdateTransactionCategoryParams,
) => {
  const existing = await getTransactionCategoryRecordById(db, {
    teamId: params.teamId,
    id: params.id,
  });

  if (!existing) {
    return null;
  }

  const result = await upsertTransactionCategoryRecord(db, {
    teamId: params.teamId,
    id: params.id,
    name: params.name ?? existing.name,
    color: params.color !== undefined ? params.color : existing.color,
    description: params.description !== undefined ? params.description : existing.description,
    taxRate: params.taxRate !== undefined ? params.taxRate : existing.taxRate,
    taxType: params.taxType !== undefined ? params.taxType : existing.taxType,
    taxReportingCode:
      params.taxReportingCode !== undefined ? params.taxReportingCode : existing.taxReportingCode,
    parentId: params.parentId !== undefined ? params.parentId : existing.parentId,
    excluded: existing.excluded,
  });

  invalidateTransactionCategoryContext(params.teamId);
  await rebuildDerivedComplianceJournalEntries(db, {
    teamId: params.teamId,
  });

  if (params.name && params.name !== existing.name) {
    generateCategoryEmbedding(db, {
      name: params.name,
      system: result.system,
    }).catch((error) => {
      console.error(`Failed to update embedding for category "${params.name}":`, error);
    });
  }

  return result;
};

export const deleteTransactionCategory = async (
  db: Database,
  params: DeleteTransactionCategoryParams,
) => {
  const result = await deleteTransactionCategoryRecord(db, {
    teamId: params.teamId,
    id: params.id,
  });

  invalidateTransactionCategoryContext(params.teamId);
  await rebuildDerivedComplianceJournalEntries(db, {
    teamId: params.teamId,
  });

  return result;
};

export async function upsertTransactionCategories(
  db: Database,
  args: {
    teamId: string;
    categories: UpsertTransactionCategoryInput[];
  },
) {
  const result = await upsertTransactionCategoryRecords(db, args);
  invalidateTransactionCategoryContext(args.teamId);
  await rebuildDerivedComplianceJournalEntries(db, {
    teamId: args.teamId,
  });
  return result;
}
