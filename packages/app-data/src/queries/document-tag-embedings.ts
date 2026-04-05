import {
  getDocumentTagEmbeddingsFromConvex,
  upsertDocumentTagEmbeddingsInConvex,
} from "../convex";
import type { Database } from "../client";

function parseEmbedding(embedding: string | number[]) {
  return Array.isArray(embedding)
    ? embedding
    : (JSON.parse(embedding) as number[]);
}

export type CreateDocumentTagEmbeddingParams = {
  slug: string;
  name: string;
  embedding: string | number[];
  model: string;
};

export async function createDocumentTagEmbedding(
  _db: Database,
  params: CreateDocumentTagEmbeddingParams,
) {
  const [result] = await upsertDocumentTagEmbeddingsInConvex({
    embeddings: [
      {
        slug: params.slug,
        name: params.name,
        embedding: parseEmbedding(params.embedding),
        model: params.model,
      },
    ],
  });

  return result;
}

export type GetDocumentTagEmbeddingsParams = {
  slugs: string[];
};

export async function getDocumentTagEmbeddings(
  _db: Database,
  params: GetDocumentTagEmbeddingsParams,
) {
  if (params.slugs.length === 0) {
    return [];
  }

  return getDocumentTagEmbeddingsFromConvex({ slugs: params.slugs });
}

export type UpsertDocumentTagEmbeddingParams = {
  slug: string;
  name: string;
  embedding: string | number[];
  model: string;
};

export async function upsertDocumentTagEmbeddings(
  _db: Database,
  params: UpsertDocumentTagEmbeddingParams[],
) {
  if (params.length === 0) {
    return [];
  }

  return upsertDocumentTagEmbeddingsInConvex({
    embeddings: params.map((param) => ({
      slug: param.slug,
      name: param.name,
      embedding: parseEmbedding(param.embedding),
      model: param.model,
    })),
  });
}
