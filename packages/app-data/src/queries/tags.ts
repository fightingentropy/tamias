import {
  createTagInConvex,
  deleteCustomerTagsForTagInConvex,
  deleteTagInConvex,
  deleteTrackerProjectTagsForTagInConvex,
  deleteTransactionTagsForTagInConvex,
  getTagByIdFromConvex,
  getTagsFromConvex,
  updateTagInConvex,
} from "../convex";
import type { Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";

type CreateTagParams = {
  teamId: string;
  name: string;
};

export const createTag = async (_db: Database, params: CreateTagParams) => {
  const { teamId, name } = params;
  const result = await createTagInConvex({
    teamId,
    name,
  });

  if (!result) {
    throw new Error("Failed to create tag");
  }

  return {
    id: result.id,
    name: result.name,
  };
};

type UpdateTagParams = {
  id: string;
  name: string;
  teamId: string;
};

export const updateTag = async (_db: Database, params: UpdateTagParams) => {
  const { id, name, teamId } = params;
  const result = await updateTagInConvex({
    teamId,
    tagId: id,
    name,
  });

  if (!result) {
    throw new Error("Tag not found");
  }

  return {
    id: result.id,
    name: result.name,
  };
};

type DeleteTagParams = {
  id: string;
  teamId: string;
};

export const deleteTag = async (_db: Database, params: DeleteTagParams) => {
  const { id, teamId } = params;
  const result = await deleteTagInConvex({
    teamId,
    tagId: id,
  });

  if (result) {
    await deleteCustomerTagsForTagInConvex({
      teamId,
      tagId: id,
    });

    await deleteTrackerProjectTagsForTagInConvex({
      teamId,
      tagId: id,
    });

    await deleteTransactionTagsForTagInConvex({
      teamId,
      tagId: id,
    });
  }

  return result;
};

export type GetTagsParams = {
  teamId: string;
};

async function getTagsImpl(_db: Database, params: GetTagsParams) {
  const { teamId } = params;
  return getTagsFromConvex({ teamId });
}

export const getTags = reuseQueryResult({
  keyPrefix: "tags",
  keyFn: (params: GetTagsParams) => params.teamId,
  load: getTagsImpl,
});

type GetTagByIdParams = {
  id: string;
  teamId: string;
};

async function getTagByIdImpl(_db: Database, params: GetTagByIdParams) {
  const { id, teamId } = params;
  return getTagByIdFromConvex({
    teamId,
    tagId: id,
  });
}

export const getTagById = reuseQueryResult({
  keyPrefix: "tag-by-id",
  keyFn: (params: GetTagByIdParams) => [params.teamId, params.id].join(":"),
  load: getTagByIdImpl,
});
