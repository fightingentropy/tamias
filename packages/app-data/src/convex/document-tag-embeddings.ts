import { api, createClient, serviceArgs } from "./base";

export type DocumentTagEmbeddingRecord = {
  slug: string;
  name: string;
  embedding: number[];
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertDocumentTagEmbeddingInput = {
  slug: string;
  name: string;
  embedding: number[];
  model?: string;
};

export async function getDocumentTagEmbeddingsFromConvex(args: {
  slugs: string[];
}) {
  return createClient().query(
    api.documentTagEmbeddings.serviceGetDocumentTagEmbeddings,
    serviceArgs({
      slugs: args.slugs,
    }),
  ) as Promise<DocumentTagEmbeddingRecord[]>;
}

export async function upsertDocumentTagEmbeddingsInConvex(args: {
  embeddings: UpsertDocumentTagEmbeddingInput[];
}) {
  return createClient().mutation(
    api.documentTagEmbeddings.serviceUpsertDocumentTagEmbeddings,
    serviceArgs({
      embeddings: args.embeddings,
    }),
  ) as Promise<DocumentTagEmbeddingRecord[]>;
}
