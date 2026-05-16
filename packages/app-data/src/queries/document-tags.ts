import { randomUUID } from "node:crypto";
import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";

export type DocumentTagRecord = {
  id: string;
  name: string;
  slug: string;
  teamId: string;
  createdAt: string;
};

type DocumentTagRow = {
  id: string;
  team_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

function toDocumentTag(row: DocumentTagRow): DocumentTagRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    teamId: row.team_id,
    createdAt: row.created_at,
  };
}

function getDocumentTagsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

async function upsertDocumentTagInD1(
  d1: CloudflareD1DatabaseBinding,
  params: { id?: string; teamId: string; name: string; slug: string },
) {
  const timestamp = new Date().toISOString();
  const existing = await d1
    .prepare(
      `select id, team_id, name, slug, created_at, updated_at
       from document_tags
       where team_id = ? and slug = ?
       limit 1`,
    )
    .bind(params.teamId, params.slug)
    .first<DocumentTagRow>();

  if (existing) {
    await d1
      .prepare(
        `update document_tags
         set name = ?, updated_at = ?
         where id = ? and team_id = ?`,
      )
      .bind(params.name, timestamp, existing.id, params.teamId)
      .run();

    return {
      ...toDocumentTag(existing),
      name: params.name,
    };
  }

  const id = params.id ?? randomUUID();

  await d1
    .prepare(
      `insert into document_tags (id, team_id, name, slug, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, params.teamId, params.name, params.slug, timestamp, timestamp)
    .run();

  return {
    id,
    teamId: params.teamId,
    name: params.name,
    slug: params.slug,
    createdAt: timestamp,
  };
}

export const getDocumentTags = async (db: Database, teamId: string) => {
  const { results = [] } = await getDocumentTagsD1(db)
    .prepare(
      `select id, team_id, name, slug, created_at, updated_at
       from document_tags
       where team_id = ?
       order by created_at desc`,
    )
    .bind(teamId)
    .all<DocumentTagRow>();

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

export const createDocumentTag = async (db: Database, params: CreateDocumentTagParams) => {
  const result = await upsertDocumentTagInD1(getDocumentTagsD1(db), {
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

export const deleteDocumentTag = async (db: Database, params: DeleteDocumentTagParams) => {
  const d1 = getDocumentTagsD1(db);
  const existing = await d1
    .prepare(
      `select id, team_id, name, slug, created_at, updated_at
       from document_tags
       where id = ? and team_id = ?
       limit 1`,
    )
    .bind(params.id, params.teamId)
    .first<DocumentTagRow>();

  if (!existing) {
    return null;
  }

  await d1
    .prepare("delete from document_tag_assignments where team_id = ? and tag_id = ?")
    .bind(params.teamId, params.id)
    .run();
  await d1
    .prepare("delete from document_tags where id = ? and team_id = ?")
    .bind(params.id, params.teamId)
    .run();

  return { id: params.id };
};

export type UpsertDocumentTagParams = {
  name: string;
  slug: string;
  teamId: string;
};

export const upsertDocumentTags = async (db: Database, params: UpsertDocumentTagParams[]) => {
  if (params.length === 0) {
    return [];
  }

  const d1 = getDocumentTagsD1(db);
  const results = [];

  for (const tag of params) {
    const result = await upsertDocumentTagInD1(d1, tag);
    results.push({
      id: result.id,
      slug: result.slug,
    });
  }

  return results;
};
