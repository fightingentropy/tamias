import {
  createDocumentTagInConvex,
  deleteDocumentTagInConvex,
  getDocumentTagsFromConvex,
  upsertDocumentTagsInConvex,
  type DocumentTagRecord,
} from "../convex";
import type { Database } from "../client";

type DocumentTag = {
  id: string;
  name: string;
  slug: string;
  teamId: string;
  createdAt: string;
};

function toDocumentTag(record: DocumentTagRecord): DocumentTag {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    teamId: record.teamId,
    createdAt: record.createdAt,
  };
}

export const getDocumentTags = async (_db: Database, teamId: string) => {
  const results = await getDocumentTagsFromConvex({ teamId });

  return results.map(({ id, name }) => ({
    id,
    name,
  }));
};

export type CreateDocumentTagParams = {
  name: string;
  teamId: string;
  slug: string;
};

export const createDocumentTag = async (
  _db: Database,
  params: CreateDocumentTagParams,
) => {
  const result = await createDocumentTagInConvex({
    teamId: params.teamId,
    name: params.name,
    slug: params.slug,
  });

  return {
    id: result.id,
    name: result.name,
    slug: result.slug,
  };
};

export type DeleteDocumentTagParams = {
  id: string;
  teamId: string;
};

export const deleteDocumentTag = async (
  _db: Database,
  params: DeleteDocumentTagParams,
) => {
  return deleteDocumentTagInConvex({
    id: params.id,
    teamId: params.teamId,
  });
};

export type UpsertDocumentTagParams = {
  name: string;
  slug: string;
  teamId: string;
};

export const upsertDocumentTags = async (
  _db: Database,
  params: UpsertDocumentTagParams[],
) => {
  if (params.length === 0) {
    return [];
  }

  return upsertDocumentTagsInConvex({
    tags: params.map((tag) => ({
      teamId: tag.teamId,
      name: tag.name,
      slug: tag.slug,
    })),
  });
};
