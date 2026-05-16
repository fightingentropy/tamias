import {
  requireCloudflareD1Database,
  type CloudflareD1DatabaseBinding,
  type Database,
} from "../client";
import { getDocumentById, type DocumentRecord } from "./documents/records";

export type DocumentTagAssignmentRecord = {
  documentId: string;
  tagId: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  documentTag: {
    id: string;
    name: string;
    slug: string;
  };
};

type DocumentTagAssignmentRow = {
  team_id: string;
  document_id: string;
  tag_id: string;
  document_created_at: string | null;
  document_date: string | null;
  created_at: string;
  updated_at: string;
  document_tag_id: string;
  document_tag_name: string;
  document_tag_slug: string;
};

export type TaggedDocumentCursor = {
  createdAt: string;
  documentId: string;
};

export type TaggedDocumentIdPage = {
  documentIds: string[];
  isDone: boolean;
  continueCursor: string | null;
};

function getDocumentTagAssignmentsD1(db: Database) {
  return requireCloudflareD1Database(db);
}

function toDocumentTagAssignment(row: DocumentTagAssignmentRow): DocumentTagAssignmentRecord {
  return {
    documentId: row.document_id,
    tagId: row.tag_id,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentTag: {
      id: row.document_tag_id,
      name: row.document_tag_name,
      slug: row.document_tag_slug,
    },
  };
}

function encodeTaggedDocumentCursor(cursor: TaggedDocumentCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeTaggedDocumentCursor(cursor: string | null | undefined): TaggedDocumentCursor | null {
  if (!cursor) {
    return null;
  }

  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<
    TaggedDocumentCursor
  >;

  if (typeof parsed.createdAt !== "string" || typeof parsed.documentId !== "string") {
    throw new Error("Invalid tagged document cursor");
  }

  return {
    createdAt: parsed.createdAt,
    documentId: parsed.documentId,
  };
}

async function getDocumentTagRow(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; tagId: string },
) {
  return d1
    .prepare(
      `select id, name, slug
       from document_tags
       where id = ? and team_id = ?
       limit 1`,
    )
    .bind(params.tagId, params.teamId)
    .first<{ id: string; name: string; slug: string }>();
}

function getDocumentSortFields(document: Pick<DocumentRecord, "createdAt" | "date"> | null) {
  if (!document) {
    throw new Error("Document tag assignment target not found");
  }

  return {
    documentCreatedAt: document.createdAt,
    documentDate: document.date ?? null,
  };
}

async function upsertDocumentTagAssignmentInD1(
  d1: CloudflareD1DatabaseBinding,
  params: UpsertDocumentTagAssignmentParams,
  document: Pick<DocumentRecord, "createdAt" | "date"> | null,
) {
  const tag = await getDocumentTagRow(d1, params);

  if (!tag) {
    throw new Error("Document tag assignment target not found");
  }

  const timestamp = new Date().toISOString();
  const sortFields = getDocumentSortFields(document);
  const existing = await d1
    .prepare(
      `select created_at
       from document_tag_assignments
       where team_id = ? and document_id = ? and tag_id = ?
       limit 1`,
    )
    .bind(params.teamId, params.documentId, params.tagId)
    .first<{ created_at: string }>();
  const createdAt = existing?.created_at ?? timestamp;

  await d1
    .prepare(
      `insert into document_tag_assignments (
         team_id,
         document_id,
         tag_id,
         document_created_at,
         document_date,
         created_at,
         updated_at
       ) values (?, ?, ?, ?, ?, ?, ?)
       on conflict(team_id, document_id, tag_id) do update set
         document_created_at = excluded.document_created_at,
         document_date = excluded.document_date,
         updated_at = excluded.updated_at`,
    )
    .bind(
      params.teamId,
      params.documentId,
      params.tagId,
      sortFields.documentCreatedAt,
      sortFields.documentDate,
      createdAt,
      timestamp,
    )
    .run();

  return {
    documentId: params.documentId,
    tagId: params.tagId,
    teamId: params.teamId,
    createdAt,
    updatedAt: timestamp,
    documentTag: {
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    },
  };
}

async function getDocumentForAssignment(db: Database, params: UpsertDocumentTagAssignmentParams) {
  return getDocumentById(db, {
    teamId: params.teamId,
    documentId: params.documentId,
  });
}

export type CreateDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const createDocumentTagAssignment = async (
  db: Database,
  params: CreateDocumentTagAssignmentParams,
) => {
  return upsertDocumentTagAssignmentInD1(
    getDocumentTagAssignmentsD1(db),
    params,
    await getDocumentForAssignment(db, params),
  );
};

export type DeleteDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const deleteDocumentTagAssignment = async (
  db: Database,
  params: DeleteDocumentTagAssignmentParams,
) => {
  const d1 = getDocumentTagAssignmentsD1(db);
  const existing = await getDocumentTagAssignmentsForDocumentIdsFromD1(d1, {
    teamId: params.teamId,
    documentIds: [params.documentId],
  }).then((assignments) => assignments.find((assignment) => assignment.tagId === params.tagId));

  if (!existing) {
    return null;
  }

  await d1
    .prepare(
      `delete from document_tag_assignments
       where team_id = ? and document_id = ? and tag_id = ?`,
    )
    .bind(params.teamId, params.documentId, params.tagId)
    .run();

  return existing;
};

export type UpsertDocumentTagAssignmentParams = {
  documentId: string;
  tagId: string;
  teamId: string;
};

export const upsertDocumentTagAssignments = async (
  db: Database,
  params: UpsertDocumentTagAssignmentParams[],
) => {
  if (params.length === 0) {
    return [];
  }

  const d1 = getDocumentTagAssignmentsD1(db);
  const results = [];

  for (const assignment of params) {
    results.push(
      await upsertDocumentTagAssignmentInD1(
        d1,
        assignment,
        await getDocumentForAssignment(db, assignment),
      ),
    );
  }

  return results;
};

export async function getDocumentTagAssignmentsForDocumentIds(
  db: Database,
  params: { teamId: string; documentIds: string[] },
) {
  return getDocumentTagAssignmentsForDocumentIdsFromD1(getDocumentTagAssignmentsD1(db), params);
}

export async function deleteDocumentTagAssignmentsForDocument(
  db: Database,
  params: { teamId: string; documentId: string },
) {
  const assignments = await getDocumentTagAssignmentsForDocumentIds(db, {
    teamId: params.teamId,
    documentIds: [params.documentId],
  });

  await d1DeleteAssignmentsForDocument(getDocumentTagAssignmentsD1(db), params);

  return assignments;
}

export async function getTaggedDocumentIdPage(
  db: Database,
  params: {
    teamId: string;
    tagIds: string[];
    cursor?: string | null;
    pageSize: number;
    order?: "asc" | "desc";
    start?: string | null;
    end?: string | null;
  },
): Promise<TaggedDocumentIdPage> {
  const d1 = getDocumentTagAssignmentsD1(db);
  const tagIds = [...new Set(params.tagIds)].filter(Boolean);

  if (tagIds.length === 0) {
    return {
      documentIds: [],
      isDone: true,
      continueCursor: null,
    };
  }

  const order = params.order ?? "desc";
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const cursor = decodeTaggedDocumentCursor(params.cursor ?? null);
  const tagPlaceholders = tagIds.map(() => "?").join(", ");
  const conditions = [
    `team_id = ?`,
    `tag_id in (${tagPlaceholders})`,
    `document_created_at is not null`,
  ];
  const bindings: unknown[] = [params.teamId, ...tagIds];

  if (cursor) {
    const operator = order === "asc" ? ">" : "<";
    conditions.push(
      `(document_created_at ${operator} ? or (document_created_at = ? and document_id ${operator} ?))`,
    );
    bindings.push(cursor.createdAt, cursor.createdAt, cursor.documentId);
  }

  if (params.start && params.end) {
    conditions.push("document_date >= ? and document_date <= ?");
    bindings.push(params.start, params.end);
  }

  const limit = Math.max(pageSize * 4, pageSize + 1);
  bindings.push(limit);

  const { results = [] } = await d1
    .prepare(
      `select document_id, document_created_at
       from document_tag_assignments
       where ${conditions.join(" and ")}
       group by document_id, document_created_at
       order by document_created_at ${order}, document_id ${order}
       limit ?`,
    )
    .bind(...bindings)
    .all<{ document_id: string; document_created_at: string }>();

  const page = results.slice(0, pageSize);
  const nextCursorRow = page.at(-1) ?? null;
  const hasNextPage = results.length > pageSize;

  return {
    documentIds: page.map((row) => row.document_id),
    isDone: !hasNextPage,
    continueCursor:
      hasNextPage && nextCursorRow
        ? encodeTaggedDocumentCursor({
            createdAt: nextCursorRow.document_created_at,
            documentId: nextCursorRow.document_id,
          })
        : null,
  };
}

async function d1DeleteAssignmentsForDocument(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; documentId: string },
) {
  await d1
    .prepare("delete from document_tag_assignments where team_id = ? and document_id = ?")
    .bind(params.teamId, params.documentId)
    .run();
}

async function getDocumentTagAssignmentsForDocumentIdsFromD1(
  d1: CloudflareD1DatabaseBinding,
  params: { teamId: string; documentIds: string[] },
) {
  if (params.documentIds.length === 0) {
    return [];
  }

  const placeholders = params.documentIds.map(() => "?").join(", ");
  const { results = [] } = await d1
    .prepare(
      `select
         a.team_id,
         a.document_id,
         a.tag_id,
         a.document_created_at,
         a.document_date,
         a.created_at,
         a.updated_at,
         t.id as document_tag_id,
         t.name as document_tag_name,
         t.slug as document_tag_slug
       from document_tag_assignments a
       inner join document_tags t
         on t.id = a.tag_id
        and t.team_id = a.team_id
       where a.team_id = ?
         and a.document_id in (${placeholders})
       order by a.created_at asc`,
    )
    .bind(params.teamId, ...params.documentIds)
    .all<DocumentTagAssignmentRow>();

  return results.map(toDocumentTagAssignment);
}
