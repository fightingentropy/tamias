import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";

const DEFAULT_MODEL = "gemini-embedding-001";

export type TransactionCategoryEmbeddingRecord = {
  name: string;
  embedding: number[];
  model: string;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

type TransactionCategoryEmbeddingRow = {
  name: string;
  embedding_json: string;
  model: string;
  system: number;
  created_at: string;
  updated_at: string;
};

function getTransactionCategoryEmbeddingsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toTransactionCategoryEmbedding(
  row: TransactionCategoryEmbeddingRow,
): TransactionCategoryEmbeddingRecord {
  return {
    name: row.name,
    embedding: JSON.parse(row.embedding_json) as number[],
    model: row.model,
    system: Boolean(row.system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCategoryEmbeddingsByNamesFromD1(
  d1: CloudflareD1DatabaseBinding,
  names: string[],
) {
  if (names.length === 0) {
    return [];
  }

  const placeholders = names.map(() => "?").join(", ");
  const { results = [] } = await d1
    .prepare(
      `select
        name,
        embedding_json,
        model,
        system,
        created_at,
        updated_at
      from transaction_category_embeddings
      where name in (${placeholders})`,
    )
    .bind(...names)
    .all<TransactionCategoryEmbeddingRow>();
  const byName = new Map(results.map((row) => [row.name, toTransactionCategoryEmbedding(row)]));

  return names
    .map((name) => byName.get(name))
    .filter((record): record is TransactionCategoryEmbeddingRecord => Boolean(record));
}

async function upsertCategoryEmbeddingInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertCategoryEmbeddingParams,
) {
  const timestamp = new Date().toISOString();
  const existing = await d1
    .prepare(
      `select
        name,
        embedding_json,
        model,
        system,
        created_at,
        updated_at
      from transaction_category_embeddings
      where name = ?
      limit 1`,
    )
    .bind(params.name)
    .first<TransactionCategoryEmbeddingRow>();
  const model = params.model ?? DEFAULT_MODEL;
  const system = params.system ?? false;

  if (existing) {
    await d1
      .prepare(
        `update transaction_category_embeddings
        set embedding_json = ?,
            model = ?,
            system = ?,
            updated_at = ?
        where name = ?`,
      )
      .bind(JSON.stringify(params.embedding), model, system ? 1 : 0, timestamp, params.name)
      .run();

    return {
      name: params.name,
      embedding: params.embedding,
      model,
      system,
      createdAt: existing.created_at,
      updatedAt: timestamp,
    };
  }

  await d1
    .prepare(
      `insert into transaction_category_embeddings (
        name,
        embedding_json,
        model,
        system,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      params.name,
      JSON.stringify(params.embedding),
      model,
      system ? 1 : 0,
      timestamp,
      timestamp,
    )
    .run();

  return {
    name: params.name,
    embedding: params.embedding,
    model,
    system,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type GetCategoryEmbeddingParams = {
  name: string;
};

export const getCategoryEmbedding = async (db: Database, params: GetCategoryEmbeddingParams) => {
  const [result] = await getCategoryEmbeddingsByNamesFromD1(getTransactionCategoryEmbeddingsD1(db), [
    params.name,
  ]);

  return result ?? null;
};

export type GetCategoryEmbeddingsByNamesParams = {
  names: string[];
};

export const getCategoryEmbeddingsByNames = async (
  db: Database,
  params: GetCategoryEmbeddingsByNamesParams,
) => {
  return getCategoryEmbeddingsByNamesFromD1(
    getTransactionCategoryEmbeddingsD1(db),
    params.names,
  );
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
  db: Database,
  params: UpsertCategoryEmbeddingParams,
) => {
  return upsertCategoryEmbeddingInD1(getTransactionCategoryEmbeddingsD1(db), params);
};
