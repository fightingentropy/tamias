import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";

const DEFAULT_MODEL = "gemini-embedding-001";

export type DocumentTagEmbeddingRecord = {
  slug: string;
  name: string;
  embedding: number[];
  model: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentTagEmbeddingRow = {
  slug: string;
  name: string;
  embedding_json: string;
  model: string;
  created_at: string;
  updated_at: string;
};

function parseEmbedding(embedding: string | number[]) {
  return Array.isArray(embedding) ? embedding : (JSON.parse(embedding) as number[]);
}

function getDocumentTagEmbeddingsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toDocumentTagEmbedding(row: DocumentTagEmbeddingRow): DocumentTagEmbeddingRecord {
  return {
    slug: row.slug,
    name: row.name,
    embedding: JSON.parse(row.embedding_json) as number[],
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getDocumentTagEmbeddingsFromD1(
  d1: CloudflareD1DatabaseBinding,
  slugs: string[],
) {
  if (slugs.length === 0) {
    return [];
  }

  const placeholders = slugs.map(() => "?").join(", ");
  const { results = [] } = await d1
    .prepare(
      `select
        slug,
        name,
        embedding_json,
        model,
        created_at,
        updated_at
      from document_tag_embeddings
      where slug in (${placeholders})`,
    )
    .bind(...slugs)
    .all<DocumentTagEmbeddingRow>();
  const bySlug = new Map(results.map((row) => [row.slug, toDocumentTagEmbedding(row)]));

  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((record): record is DocumentTagEmbeddingRecord => Boolean(record));
}

async function upsertDocumentTagEmbeddingInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertDocumentTagEmbeddingParams,
) {
  const timestamp = new Date().toISOString();
  const embedding = parseEmbedding(params.embedding);
  const model = params.model || DEFAULT_MODEL;
  const existing = await d1
    .prepare(
      `select
        slug,
        name,
        embedding_json,
        model,
        created_at,
        updated_at
      from document_tag_embeddings
      where slug = ?
      limit 1`,
    )
    .bind(params.slug)
    .first<DocumentTagEmbeddingRow>();

  if (existing) {
    await d1
      .prepare(
        `update document_tag_embeddings
        set name = ?,
            embedding_json = ?,
            model = ?,
            updated_at = ?
        where slug = ?`,
      )
      .bind(params.name, JSON.stringify(embedding), model, timestamp, params.slug)
      .run();

    return {
      slug: params.slug,
      name: params.name,
      embedding,
      model,
      createdAt: existing.created_at,
      updatedAt: timestamp,
    };
  }

  await d1
    .prepare(
      `insert into document_tag_embeddings (
        slug,
        name,
        embedding_json,
        model,
        created_at,
        updated_at
      ) values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(params.slug, params.name, JSON.stringify(embedding), model, timestamp, timestamp)
    .run();

  return {
    slug: params.slug,
    name: params.name,
    embedding,
    model,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export type CreateDocumentTagEmbeddingParams = {
  slug: string;
  name: string;
  embedding: string | number[];
  model: string;
};

export async function createDocumentTagEmbedding(
  db: Database,
  params: CreateDocumentTagEmbeddingParams,
) {
  return upsertDocumentTagEmbeddingInD1(getDocumentTagEmbeddingsD1(db), params);
}

export type GetDocumentTagEmbeddingsParams = {
  slugs: string[];
};

export async function getDocumentTagEmbeddings(
  db: Database,
  params: GetDocumentTagEmbeddingsParams,
) {
  return getDocumentTagEmbeddingsFromD1(getDocumentTagEmbeddingsD1(db), params.slugs);
}

export type UpsertDocumentTagEmbeddingParams = {
  slug: string;
  name: string;
  embedding: string | number[];
  model: string;
};

export async function upsertDocumentTagEmbeddings(
  db: Database,
  params: UpsertDocumentTagEmbeddingParams[],
) {
  if (params.length === 0) {
    return [];
  }

  const d1 = getDocumentTagEmbeddingsD1(db);
  const results = [];

  for (const param of params) {
    results.push(await upsertDocumentTagEmbeddingInD1(d1, param));
  }

  return results;
}
