import { type CloudflareD1DatabaseBinding, type Database } from "../client";
import { reuseQueryResult } from "../utils/request-cache";
import { deleteCustomerTagsForTagInD1 } from "./customers/d1";
import { deleteTrackerProjectTagsForTagInD1 } from "./tracker-projects/d1";
import { deleteTransactionTagsForTagInD1, requireTransactionsD1 } from "./transactions/d1";

export type TagRecord = {
  id: string;
  teamId: string;
  name: string;
  createdAt: string;
};

type CreateTagParams = {
  teamId: string;
  name: string;
};

type TagRow = {
  id: string;
  team_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

function toTagRecord(row: TagRow): TagRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

async function getTagsFromD1(d1: CloudflareD1DatabaseBinding, teamId: string) {
  const { results = [] } = await d1
    .prepare("select * from tags where team_id = ? order by name asc")
    .bind(teamId)
    .all<TagRow>();

  return results.map(toTagRecord);
}

async function getTagByIdFromD1(d1: CloudflareD1DatabaseBinding, params: GetTagByIdParams) {
  const row = await d1
    .prepare("select * from tags where id = ? and team_id = ? limit 1")
    .bind(params.id, params.teamId)
    .first<TagRow>();

  return row ? toTagRecord(row) : null;
}

async function deleteTagFromD1(d1: CloudflareD1DatabaseBinding, params: DeleteTagParams) {
  await d1
    .prepare("delete from tags where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();
}

export const createTag = async (db: Database, params: CreateTagParams) => {
  const { teamId, name } = params;
  const d1 = requireTransactionsD1(db);
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    await d1
      .prepare("insert into tags (id, team_id, name, created_at, updated_at) values (?, ?, ?, ?, ?)")
      .bind(id, teamId, name, timestamp, timestamp)
      .run();
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
      throw new Error("Tag already exists");
    }

    throw error;
  }

  const result = await getTagByIdFromD1(d1, { teamId, id });

  return {
    id,
    name: result?.name ?? name,
  };
};

type UpdateTagParams = {
  id: string;
  name: string;
  teamId: string;
};

export const updateTag = async (db: Database, params: UpdateTagParams) => {
  const { id, name, teamId } = params;
  const d1 = requireTransactionsD1(db);
  const existing = await getTagByIdFromD1(d1, params);

  if (!existing) {
    throw new Error("Tag not found");
  }

  const timestamp = new Date().toISOString();
  await d1
    .prepare("update tags set name = ?, updated_at = ? where id = ? and team_id = ?")
    .bind(name, timestamp, id, teamId)
    .run();

  return {
    id,
    name,
  };
};

type DeleteTagParams = {
  id: string;
  teamId: string;
};

export const deleteTag = async (db: Database, params: DeleteTagParams) => {
  const { id, teamId } = params;
  const d1 = requireTransactionsD1(db);
  const existing = await getTagByIdFromD1(d1, params);

  if (existing) {
    await deleteTransactionTagsForTagInD1(d1, {
      teamId,
      tagId: id,
    });
    await deleteCustomerTagsForTagInD1(d1, {
      teamId,
      tagId: id,
    });
    await deleteTrackerProjectTagsForTagInD1(d1, {
      teamId,
      tagId: id,
    });
    await deleteTagFromD1(d1, params);
  }

  return existing ? { id: existing.id, name: existing.name } : null;
};

export type GetTagsParams = {
  teamId: string;
};

async function getTagsImpl(db: Database, params: GetTagsParams) {
  const { teamId } = params;
  return getTagsFromD1(requireTransactionsD1(db), teamId);
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

async function getTagByIdImpl(db: Database, params: GetTagByIdParams) {
  return getTagByIdFromD1(requireTransactionsD1(db), params);
}

export const getTagById = reuseQueryResult({
  keyPrefix: "tag-by-id",
  keyFn: (params: GetTagByIdParams) => [params.teamId, params.id].join(":"),
  load: getTagByIdImpl,
});
